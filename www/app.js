// Use global utilities
const {
    saveToLocal,
    loadFromLocal,
    exportToCSV,
    downloadText,
    getNewProjectState,
    listSavedProjects,
    saveProjectToLibrary,
    loadProjectFromLibrary,
    deleteProjectFromLibrary,
    exportToJSON,
    importFromJSON
} = window.StoryWriterStorage;
const { generateProse } = window.StoryWriterAI;

// State Management
let state;

// DOM Elements
const elements = {
    // Header
    projectName: document.getElementById('project-name'),
    apiKeyInput: document.getElementById('api-key'),
    apiStatusDot: document.getElementById('api-status-dot'),
    apiStatusText: document.getElementById('api-status-text'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    libraryBtn: document.getElementById('library-btn'),
    saveProjectBtn: document.getElementById('save-project-btn'),

    // Sidebar
    chapterLedger: document.getElementById('chapter-ledger'),
    characterList: document.getElementById('character-list'),

    // Workspace
    chapterTitle: document.getElementById('chapter-title'),
    chapterGoal: document.getElementById('chapter-goal'),
    chapterSetting: document.getElementById('chapter-setting'),
    chapterTone: document.getElementById('chapter-tone'),
    proseOutput: document.getElementById('prose-output'),

    // Modals
    characterModal: document.getElementById('character-modal'),
    archiveModal: document.getElementById('archive-modal'),
    libraryModal: document.getElementById('library-modal'),
    projectList: document.getElementById('project-list'),
    charName: document.getElementById('char-name'),
    charRole: document.getElementById('char-role'),
    archiveSummary: document.getElementById('archive-summary'),

    // Buttons
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    addCharacterBtn: document.getElementById('add-character-btn'),
    saveCharacterBtn: document.getElementById('save-character-btn'),
    closeCharacterBtn: document.getElementById('close-character-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonBtn: document.getElementById('import-json-btn'),
    importJsonInput: document.getElementById('import-json-input'),
    closeLibraryBtn: document.getElementById('close-library-btn'),
    createNewProjectBtn: document.getElementById('create-new-project-btn'),
    generateBtn: document.getElementById('generate-chapter-btn'),
    newChapterBtn: document.getElementById('new-chapter-btn'),
    downloadProseBtn: document.getElementById('download-prose-btn'),
    confirmArchiveBtn: document.getElementById('confirm-archive-btn'),
    cancelArchiveBtn: document.getElementById('cancel-archive-btn')
};

// Initialization
const init = async () => {
    console.log("App: Initializing...");

    // Load initial state
    if (!state) {
        state = await loadFromLocal();
    }

    // Populate fields
    elements.projectName.value = state.projectName || '';
    elements.chapterTitle.value = state.currentChapter.title || '';
    elements.chapterGoal.value = state.currentChapter.goal || '';
    elements.chapterSetting.value = state.currentChapter.setting || '';
    elements.chapterTone.value = state.currentChapter.tone || '';
    elements.apiKeyInput.value = state.apiKey || '';

    elements.proseOutput.innerHTML = state.currentChapter.prose
        ? state.currentChapter.prose.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '<br>').join('')
        : '<p class="placeholder-text">Your generated story will appear here...</p>';

    updateApiStatus();
    renderCharacters();
    renderLedger();
    setupEventListeners();
};

const updateApiStatus = () => {
    if (state.apiKey && state.apiKey.length > 20) {
        elements.apiStatusDot.classList.add('connected');
        elements.apiStatusText.innerText = 'API Key Ready';
    } else {
        elements.apiStatusDot.classList.remove('connected');
        elements.apiStatusText.innerText = 'API Key Required';
    }
};

const renderCharacters = () => {
    elements.characterList.innerHTML = state.characters.map((char, index) => `
        <div class="character-item" data-index="${index}">
            <div class="character-info">
                <h4>${char.name}</h4>
                <p>${char.role}</p>
            </div>
            <button class="icon-btn delete-char" data-index="${index}">🗑️</button>
        </div>
    `).join('');

    document.querySelectorAll('.delete-char').forEach(btn => {
        btn.onclick = async (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            state.characters.splice(index, 1);
            await saveState();
            renderCharacters();
        };
    });
};

const renderLedger = () => {
    if (!state.chapters || state.chapters.length === 0) {
        elements.chapterLedger.innerHTML = '<p class="empty-msg">No chapters archived yet.</p>';
        return;
    }

    elements.chapterLedger.innerHTML = state.chapters.map((ch, index) => `
        <div class="ledger-item" data-index="${index}">
            <h4>${ch.title || `Chapter ${index + 1}`}</h4>
            <p style="font-size: 0.75rem; color: var(--text-secondary);">${ch.summary.substring(0, 60)}...</p>
        </div>
    `).reverse().join('');

    document.querySelectorAll('.ledger-item').forEach(item => {
        item.onclick = () => {
            const index = parseInt(item.dataset.index);
            const ch = state.chapters[index];
            if (confirm(`Load "${ch.title}"? This will overwrite your current workspace.`)) {
                state.currentChapter = { ...ch, prose: ch.prose };
                init();
            }
        };
    });
};

const renderLibrary = async () => {
    console.log("App: Rendering library...");
    const projects = await listSavedProjects();
    if (projects.length === 0) {
        elements.projectList.innerHTML = '<p class="empty-msg">No projects saved in library.</p>';
        return;
    }

    elements.projectList.innerHTML = projects.sort((a, b) => b.lastModified - a.lastModified).map(p => `
        <div class="character-item project-item" data-id="${p.id}">
            <div class="character-info">
                <h4>${p.name}</h4>
                <p>${p.chapterCount} chapters • Last modified: ${new Date(p.lastModified).toLocaleDateString()}</p>
            </div>
            <div class="action-group">
                <button class="secondary-btn load-project" data-id="${p.id}">Load</button>
                <button class="icon-btn delete-project" data-id="${p.id}">🗑️</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.load-project').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const loadedState = await loadProjectFromLibrary(id);
            if (loadedState) {
                state = loadedState;
                init();
                elements.libraryModal.classList.add('hidden');
            }
        };
    });

    // Handle clicking the item itself to load
    document.querySelectorAll('.project-item .character-info').forEach(item => {
        item.onclick = async (e) => {
            const id = item.closest('.project-item').dataset.id;
            const loadedState = await loadProjectFromLibrary(id);
            if (loadedState) {
                state = loadedState;
                init();
                elements.libraryModal.classList.add('hidden');
            }
        };
    });

    document.querySelectorAll('.delete-project').forEach(btn => {
        btn.onclick = async () => {
            if (confirm("Delete this project from your library? This cannot be undone.")) {
                await deleteProjectFromLibrary(btn.dataset.id);
                renderLibrary();
            }
        };
    });
};

const saveState = async () => {
    state.projectName = elements.projectName.value;
    state.currentChapter = {
        title: elements.chapterTitle.value,
        goal: elements.chapterGoal.value,
        setting: elements.chapterSetting.value,
        tone: elements.chapterTone.value,
        prose: state.currentChapter.prose || ''
    };
    state.apiKey = elements.apiKeyInput.value;
    await saveToLocal(state);
};

const setupEventListeners = () => {
    // Auto-save on input
    [elements.projectName, elements.chapterTitle, elements.chapterGoal, elements.chapterSetting, elements.chapterTone].forEach(el => {
        el.oninput = saveState;
    });

    // Modals
    elements.settingsBtn.onclick = () => elements.settingsModal.classList.remove('hidden');
    elements.closeSettingsBtn.onclick = () => elements.settingsModal.classList.add('hidden');
    elements.saveSettingsBtn.onclick = async () => {
        await saveState();
        updateApiStatus();
        elements.settingsModal.classList.add('hidden');
    };

    elements.libraryBtn.onclick = async () => {
        await renderLibrary();
        elements.libraryModal.classList.remove('hidden');
    };
    elements.closeLibraryBtn.onclick = () => elements.libraryModal.classList.add('hidden');

    elements.addCharacterBtn.onclick = () => {
        elements.charName.value = '';
        elements.charRole.value = '';
        elements.characterModal.classList.remove('hidden');
    };
    elements.closeCharacterBtn.onclick = () => elements.characterModal.classList.add('hidden');
    elements.saveCharacterBtn.onclick = async () => {
        const name = elements.charName.value.trim();
        const role = elements.charRole.value.trim();
        if (name) {
            state.characters.push({ name, role });
            await saveState();
            renderCharacters();
            elements.characterModal.classList.add('hidden');
        }
    };

    // Project Actions
    elements.saveProjectBtn.onclick = async () => {
        await saveState();
        await saveProjectToLibrary(state);
        alert("Project saved to library! It will now persist even if you restart your browser.");
    };

    elements.createNewProjectBtn.onclick = () => {
        if (confirm("Start a new project? Any unsaved changes in the current project might be lost.")) {
            state = getNewProjectState();
            init();
            elements.libraryModal.classList.add('hidden');
        }
    };

    // JSON Backups
    elements.exportJsonBtn.onclick = () => exportToJSON(state);
    elements.importJsonBtn.onclick = () => elements.importJsonInput.click();
    elements.importJsonInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const importedState = await importFromJSON(file);
            state = importedState;
            await saveProjectToLibrary(state);
            init();
            alert("Project imported and saved to library!");
        } catch (err) {
            alert("Error importing project: " + err.message);
        }
        e.target.value = ''; // Reset input
    };

    // Exports
    elements.exportCsvBtn.onclick = () => exportToCSV(state);

    elements.downloadProseBtn.onclick = () => {
        if (!state.currentChapter.prose) {
            alert("No prose to download yet!");
            return;
        }
        const filename = `${elements.projectName.value || 'story'}_${elements.chapterTitle.value || 'chapter'}.txt`;
        downloadText(filename, state.currentChapter.prose);
    };

    elements.newChapterBtn.onclick = () => {
        if (state.currentChapter.prose) {
            elements.archiveSummary.value = '';
            elements.archiveModal.classList.remove('hidden');
        } else {
            resetWorkspace();
        }
    };

    elements.cancelArchiveBtn.onclick = () => elements.archiveModal.classList.add('hidden');

    elements.confirmArchiveBtn.onclick = async () => {
        const summary = elements.archiveSummary.value.trim();
        if (!summary) {
            alert("Please provide a brief summary for continuity.");
            return;
        }

        // Archive
        state.chapters.push({
            ...state.currentChapter,
            summary: summary
        });

        await resetWorkspace();
        elements.archiveModal.classList.add('hidden');
    };

    const resetWorkspace = async () => {
        state.currentChapter = { title: '', goal: '', setting: '', tone: '', prose: '' };
        await saveState();
        init();
    };

    // Generate
    elements.generateBtn.onclick = async () => {
        if (!state.apiKey) {
            alert('Please add your API key in settings.');
            elements.settingsModal.classList.remove('hidden');
            return;
        }

        elements.proseOutput.innerHTML = '<p class="placeholder-text pulse">Drafting chapter... ✒️</p>';
        elements.generateBtn.disabled = true;

        try {
            const prose = await generateProse(state);
            state.currentChapter.prose = prose;
            await saveState();
            elements.proseOutput.innerHTML = prose.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '<br>').join('');
        } catch (error) {
            console.error(error);
            elements.proseOutput.innerHTML = `<p class="placeholder-text" style="color: var(--danger)">Error: ${error.message}</p>`;
        } finally {
            elements.generateBtn.disabled = false;
        }
    };
};

init();
