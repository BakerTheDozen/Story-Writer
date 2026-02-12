# Story Writer: Android APK Build Guide

Since this environment doesn't have the full Android SDK and Java installed, you will need to run these final steps on your computer to generate the `.apk` file.

## Prerequisites
Ensure the following are installed on your machine:
1.  **Node.js**: [Download here](https://nodejs.org/)
2.  **Java (JDK 17 or 21)**: [Download here](https://www.oracle.com/java/technologies/downloads/)
3.  **Android Studio**: [Download here](https://developer.android.com/studio)

## Build Steps

1.  **Open Terminal** in the `Story writer` folder.
2.  **Install Capacitor**:
    ```bash
    npm install
    ```
3.  **Initialize Android Project**:
    ```bash
    npx cap add android
    ```
4.  **Sync Code**:
    (Run this every time you change your web code)
    ```bash
    npx cap sync
    ```
5.  **Build the APK**:
    ```bash
    npx cap open android
    ```
    *   This will open **Android Studio**.
    *   Wait for the project to load (indexing).
    *   Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
    *   Once finished, a notification will appear. Click "Locate" to find your `app-debug.apk`.

## Side-loading to your Phone
1.  Copy the `app-debug.apk` to your phone (via USB, Drive, or Email).
2.  On your phone, open the file and tap **Install**.
    *   *Note: You may need to "Allow apps from unknown sources" in settings.*

---
**Tip**: If you just want to test it quickly without all these tools, you can now also "Install" it as a **PWA** by opening your local `index.html` in Chrome on your phone and tapping **Add to Home Screen**!
