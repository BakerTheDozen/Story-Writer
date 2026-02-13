const STORAGE_KEY = 'story_writer_data';
const LIBRARY_KEY = 'story_writer_library';
const DB_NAME = 'StoryWriterDB';
const STORES = {
    PROJECTS: 'projects',
    METADATA: 'metadata'
};

window.StoryWriterStorage = {
    _db: null,

    initDB: async () => {
        if (window.StoryWriterStorage._db) return window.StoryWriterStorage._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
                    db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.METADATA)) {
                    db.createObjectStore(STORES.METADATA);
                }
            };

            request.onsuccess = async (event) => {
                window.StoryWriterStorage._db = event.target.result;
                console.log("Storage: IndexedDB initialized.");
                await window.StoryWriterStorage.autoMigrate();
                resolve(window.StoryWriterStorage._db);
            };

            request.onerror = (event) => {
                console.error("Storage: IndexedDB initialization failed.", event.target.error);
                reject(event.target.error);
            };
        });
    },

    autoMigrate: async () => {
        const db = window.StoryWriterStorage._db;
        const libraryData = localStorage.getItem(LIBRARY_KEY);

        if (libraryData) {
            console.log("Storage: Legacy library data found in localStorage. Checking for migration...");
            try {
                const libraryList = JSON.parse(libraryData);
                for (const item of libraryList) {
                    const projectData = localStorage.getItem(`project_data_${item.id}`);
                    if (projectData) {
                        try {
                            const parsedProject = JSON.parse(projectData);
                            // Verify project doesn't exist in IndexedDB before saving
                            const existing = await new Promise(r => {
                                const req = db.transaction(STORES.PROJECTS).objectStore(STORES.PROJECTS).get(item.id);
                                req.onsuccess = () => r(req.result);
                                req.onerror = () => r(null);
                            });

                            if (!existing) {
                                console.log(`Storage: Migrating project "${item.name}" to IndexedDB...`);
                                // Recursive call but it's safe because db is now initialized
                                await window.StoryWriterStorage.saveToLocal(parsedProject);
                            }
                        } catch (e) {
                            console.error(`Storage: Failed to migrate project ${item.id}`, e);
                        }
                    }
                }
                console.log("Storage: Migration sweep complete.");
                // We keep localStorage for now as a safety net, but future saves will prefer IndexedDB
            } catch (e) {
                console.error("Storage: Migration failed.", e);
            }
        }
    },

    // Basic Persistence
    saveToLocal: async (data) => {
        const db = await window.StoryWriterStorage.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.PROJECTS, STORES.METADATA], 'readwrite');

            // Save project data
            tx.objectStore(STORES.PROJECTS).put(data);

            // Save active ID for startup
            tx.objectStore(STORES.METADATA).put(data.id, 'active_project_id');

            // Backup to localStorage as secondary safety
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            tx.oncomplete = () => {
                console.log("Storage: Project saved to IndexedDB.");
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    },

    loadFromLocal: async () => {
        const db = await window.StoryWriterStorage.initDB();

        // Try IndexedDB first
        const activeId = await new Promise((resolve) => {
            const request = db.transaction(STORES.METADATA).objectStore(STORES.METADATA).get('active_project_id');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });

        if (activeId) {
            const project = await new Promise((resolve) => {
                const request = db.transaction(STORES.PROJECTS).objectStore(STORES.PROJECTS).get(activeId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
            if (project) {
                console.log(`Storage: Loaded active project "${project.projectName}" from IndexedDB.`);
                return window.StoryWriterStorage.migrate(project);
            }
        }

        // Fallback to localStorage
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log("Storage: Loaded project from localStorage fallback.");
                return window.StoryWriterStorage.migrate(parsed);
            } catch (e) {
                console.error("Storage: Failed to parse localStorage fallback.", e);
            }
        }

        console.log("Storage: No active project found. Returning new state.");
        return window.StoryWriterStorage.getNewProjectState();
    },

    migrate: (parsed) => {
        if (!parsed) return window.StoryWriterStorage.getNewProjectState();

        // Migration logic for older versions
        if (parsed.chapter && !parsed.currentChapter) {
            parsed.currentChapter = {
                title: '',
                goal: parsed.chapter.goal || '',
                setting: parsed.chapter.setting || '',
                tone: parsed.chapter.tone || '',
                prose: ''
            };
            delete parsed.chapter;
        }

        // Ensure all required fields exist
        if (!parsed.chapters) parsed.chapters = [];
        if (!parsed.projectName) parsed.projectName = '';
        if (!parsed.currentChapter) parsed.currentChapter = { title: '', goal: '', setting: '', tone: '', prose: '' };
        if (!parsed.characters) parsed.characters = [];
        if (!parsed.id) parsed.id = 'project_' + Date.now();

        return parsed;
    },

    getNewProjectState: () => ({
        id: 'project_' + Date.now(),
        apiKey: localStorage.getItem('story_writer_last_api_key') || '',
        projectName: 'New Project',
        currentChapter: { title: '', goal: '', setting: '', tone: '', prose: '' },
        characters: [],
        chapters: []
    }),

    // Library Management
    listSavedProjects: async () => {
        const db = await window.StoryWriterStorage.initDB();
        return new Promise((resolve) => {
            const request = db.transaction(STORES.PROJECTS).objectStore(STORES.PROJECTS).getAll();
            request.onsuccess = () => {
                const projects = request.result;
                const library = projects.map(p => ({
                    id: p.id,
                    name: p.projectName || 'Untitled Project',
                    lastModified: Date.now(),
                    chapterCount: (p.chapters || []).length
                }));
                console.log(`Storage: Library loaded from IndexedDB (${library.length} projects).`);
                resolve(library);
            };
            request.onerror = () => {
                console.error("Storage: Failed to list projects from IndexedDB.");
                resolve([]);
            };
        });
    },

    saveProjectToLibrary: async (state) => {
        if (!state || !state.id) return;
        console.log(`Storage: Saving project "${state.projectName}" to Library...`);
        await window.StoryWriterStorage.saveToLocal(state);
    },

    loadProjectFromLibrary: async (id) => {
        const db = await window.StoryWriterStorage.initDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORES.PROJECTS).objectStore(STORES.PROJECTS).get(id);
            request.onsuccess = () => {
                const project = request.result;
                if (project) {
                    db.transaction(STORES.METADATA, 'readwrite').objectStore(STORES.METADATA).put(id, 'active_project_id');
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
                }
                resolve(project);
            };
            request.onerror = () => reject(request.error);
        });
    },

    deleteProjectFromLibrary: async (id) => {
        const db = await window.StoryWriterStorage.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.PROJECTS, STORES.METADATA], 'readwrite');
            tx.objectStore(STORES.PROJECTS).delete(id);

            const metadataReq = tx.objectStore(STORES.METADATA).get('active_project_id');
            metadataReq.onsuccess = () => {
                if (metadataReq.result === id) {
                    tx.objectStore(STORES.METADATA).delete('active_project_id');
                    localStorage.removeItem(STORAGE_KEY);
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    // JSON Backup/Restore
    exportToJSON: async (data) => {
        if (window.StoryWriterGDrive && window.StoryWriterGDrive._accessToken) {
            try {
                const folderId = await window.StoryWriterGDrive.getProjectFolderId();
                const filename = `${data.projectName.replace(/\s+/g, '_') || 'story_writer_project'}.json`;
                await window.StoryWriterGDrive.saveFile(filename, JSON.stringify(data, null, 2), 'application/json', folderId);
                alert("Project backed up to Google Drive (Project folder)!");
            } catch (err) {
                alert("Failed to save to Google Drive: " + err.message);
            }
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${data.projectName.replace(/\s+/g, '_') || 'story_writer_project'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    importFromJSON: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.projectName && data.currentChapter) {
                        if (!data.id) data.id = 'project_' + Date.now();
                        resolve(data);
                    } else {
                        reject(new Error("Invalid project file format."));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("File reading failed."));
            reader.readAsText(file);
        });
    },

    listProjectFilesFromDrive: async () => {
        if (window.StoryWriterGDrive && window.StoryWriterGDrive._accessToken) {
            return await window.StoryWriterGDrive.listProjectFiles();
        }
        return [];
    },

    downloadFileFromDrive: async (fileId) => {
        if (window.StoryWriterGDrive && window.StoryWriterGDrive._accessToken) {
            return await window.StoryWriterGDrive.getFileContent(fileId);
        }
        throw new Error("Google Drive not connected.");
    },

    // Exports
    exportToCSV: async (data) => {
        let csvContent = "Type,Title/Name,Goal/Role,Tone/Description,Prose/Summary\n";
        csvContent += `Project,"${data.projectName.replace(/"/g, '""')}",,, \n`;

        data.characters.forEach(char => {
            csvContent += `Character,"${char.name.replace(/"/g, '""')}","${char.role.replace(/"/g, '""')}",, \n`;
        });

        data.chapters.forEach(ch => {
            csvContent += `Archived Chapter,"${ch.title.replace(/"/g, '""')}","${ch.goal.replace(/"/g, '""')}","${ch.summary.replace(/"/g, '""')}","${ch.prose.substring(0, 100).replace(/"/g, '""')}..."\n`;
        });

        if (window.StoryWriterGDrive && window.StoryWriterGDrive._accessToken) {
            try {
                const folderId = await window.StoryWriterGDrive.getProjectFolderId();
                const filename = `${data.projectName || 'story'}_full_export.csv`;
                await window.StoryWriterGDrive.saveFile(filename, csvContent, 'text/csv', folderId);
                alert("Project export saved to Google Drive (Project folder)!");
            } catch (err) {
                alert("Failed to save to Google Drive: " + err.message);
            }
            return;
        }

        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${data.projectName || 'story'}_full_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    downloadText: async (filename, text) => {
        if (window.StoryWriterGDrive && window.StoryWriterGDrive._accessToken) {
            try {
                const folderId = await window.StoryWriterGDrive.getRootFolderId();
                await window.StoryWriterGDrive.saveFile(filename, text, 'text/plain', folderId);
                alert("Chapter saved to Google Drive (Story Writer folder)!");
            } catch (err) {
                alert("Failed to save to Google Drive: " + err.message);
            }
            return;
        }

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
};
