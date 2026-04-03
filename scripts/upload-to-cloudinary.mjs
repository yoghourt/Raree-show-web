import { config as loadEnv } from "dotenv"
import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import path from "path"

loadEnv({ path: ".env.local" })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
})

const PUBLIC_DIR = "./public"

async function uploadAll() {
  const folders = fs.readdirSync(PUBLIC_DIR)
  
  for (const folder of folders) {
    const folderPath = path.join(PUBLIC_DIR, folder)
    if (!fs.statSync(folderPath).isDirectory()) continue
    
    const files = fs.readdirSync(folderPath)
    const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    
    console.log(`Uploading ${images.length} images from ${folder}/...`)
    
    for (const file of images) {
      const filePath = path.join(folderPath, file)
      const publicId = `raree-show/${folder}/${path.parse(file).name}`
      
      try {
        const result = await cloudinary.uploader.upload(filePath, {
          public_id: publicId,
          overwrite: true,
        })
        console.log(`  ✓ ${file} → ${result.secure_url}`)
      } catch (err) {
        console.warn(`  ✗ ${file}: ${err.message}`)
      }
    }
  }
  
  console.log("\nDone.")
}

uploadAll()