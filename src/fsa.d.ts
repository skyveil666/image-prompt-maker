/**
 * Type augmentations for File System Access API features that are not yet
 * fully typed in the TypeScript bundled DOM lib.
 *
 * Covers: queryPermission / requestPermission, entries(), showDirectoryPicker,
 * FileSystemHandlePermissionDescriptor.
 */

interface FileSystemHandlePermissionDescriptor {
  mode: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: object): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: object): Promise<FileSystemFileHandle>;
}
