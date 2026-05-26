import fs from "fs";
import path from "path";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";

const ALLOWED_MIME = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

const MAX_SIZE = 5 * 1024 * 1024;
export const MAX_FILES = 10;

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 6);
    const safe = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".mp3", ".wav", ".mp4", ".webm", ".mov", ".doc", ".docx"].includes(ext)
      ? ext.replace(".", "")
      : "bin";
    cb(null, `${uuidv4()}.${safe}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const blocked = [".exe", ".bat", ".cmd", ".sh", ".php", ".js", ".html", ".svg", ".zip", ".rar"];
    if (blocked.includes(ext)) {
      return cb(new Error("TYPE_BLOCKED"));
    }
    cb(null, true);
  },
});

export async function verifyUploadedFile(filePath) {
  const type = await fileTypeFromFile(filePath);
  if (!type || !ALLOWED_MIME[type.mime]) {
    fs.unlinkSync(filePath);
    throw new Error("INVALID_FILE_TYPE");
  }
  return ALLOWED_MIME[type.mime];
}
