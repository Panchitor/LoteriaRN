import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "C:/LotAgencia/storage/videos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const filename = (await params).filename;
    const filePath = path.join(STORAGE_PATH, filename);
    
    if (!fs.existsSync(filePath)) {
      return new NextResponse("Video no encontrado", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      const webStream = require("stream").Readable.toWeb(fileStream);

      const headers = new Headers();
      headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunksize.toString());
      headers.set("Content-Type", "video/mp4");

      // @ts-ignore
      return new NextResponse(webStream, { status: 206, headers });
    } else {
      const headers = new Headers();
      headers.set("Content-Length", fileSize.toString());
      headers.set("Content-Type", "video/mp4");

      const fileStream = fs.createReadStream(filePath);
      const webStream = require("stream").Readable.toWeb(fileStream);
      
      // @ts-ignore
      return new NextResponse(webStream, { status: 200, headers });
    }
  } catch (error) {
    console.error("Error streaming video:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
