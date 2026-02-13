window.StoryWriterGDrive = {
    // Configuration - Placeholder for the user to fill
    CLIENT_ID: '1063763764497-pnq2dpsbcge2nbq25756an9g16rg20pi.apps.googleusercontent.com',
    SCOPES: ['https://www.googleapis.com/auth/drive.file'],

    _accessToken: null,
    _folderCache: {},

    /**
     * Initialize the Google Auth plugin and sign in if necessary
     */
    init: async function () {
        console.log("GDrive: Initializing...");
        try {
            const { GoogleAuth } = window.Capacitor.Plugins;
            if (!GoogleAuth) {
                throw new Error("GoogleAuth plugin not found. Please ensure it is installed and registered.");
            }

            // On web/Android, initialization is handled by Capacitor
            const user = await GoogleAuth.signIn();
            this._accessToken = user.authentication.accessToken;
            console.log("GDrive: Signed in successfully.");
            return true;
        } catch (error) {
            console.error("GDrive: Sign-in failed", error);
            return false;
        }
    },

    /**
     * Get the root 'Story Writer' folder ID
     */
    getRootFolderId: async function () {
        if (this._folderCache['root']) return this._folderCache['root'];

        const folderId = await this.findOrCreateFolder('Story Writer');
        this._folderCache['root'] = folderId;
        return folderId;
    },

    /**
     * Get the 'Project' subfolder ID
     */
    getProjectFolderId: async function () {
        if (this._folderCache['project']) return this._folderCache['project'];

        const rootId = await this.getRootFolderId();
        const folderId = await this.findOrCreateFolder('Project', rootId);
        this._folderCache['project'] = folderId;
        return folderId;
    },

    /**
     * Find a folder by name, or create it if it doesn't exist
     */
    findOrCreateFolder: async function (name, parentId = null) {
        console.log(`GDrive: Finding folder "${name}"...`);
        let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${this._accessToken}` }
        });

        const data = await response.json();
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }

        // Not found, create it
        console.log(`GDrive: Creating folder "${name}"...`);
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId ? [parentId] : []
            })
        });

        const createData = await createResponse.json();
        return createData.id;
    },

    /**
     * Upload a file to a specific folder
     */
    saveFile: async function (filename, content, mimeType, folderId) {
        console.log(`GDrive: Saving file "${filename}"...`);

        // Check if file exists to update or create
        const query = `name = '${filename}' and '${folderId}' in parents and trashed = false`;
        const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${this._accessToken}` }
        });
        const searchData = await searchResponse.json();
        const existingFileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

        const metadata = {
            name: filename,
            mimeType: mimeType,
            parents: existingFileId ? undefined : [folderId]
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([content], { type: mimeType }));

        const url = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const response = await fetch(url, {
            method: existingFileId ? 'PATCH' : 'POST',
            headers: { 'Authorization': `Bearer ${this._accessToken}` },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GDrive Upload failed: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
    },

    /**
     * List files in the Project folder for restore
     */
    listProjectFiles: async function () {
        const folderId = await this.getProjectFolderId();
        // Remove or broaden MIME type filter. Since it's a specific "Project" folder, listing all files is safer.
        const query = `'${folderId}' in parents and trashed = false`;

        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, modifiedTime)`, {
            headers: { 'Authorization': `Bearer ${this._accessToken}` }
        });

        const data = await response.json();
        return data.files || [];
    },

    /**
     * Download a file by ID
     */
    getFileContent: async function (fileId) {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${this._accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`GDrive Download failed: ${response.statusText}`);
        }

        return await response.json();
    }
};
