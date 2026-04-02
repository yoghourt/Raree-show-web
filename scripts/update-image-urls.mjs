import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

cloudinary.config({
  cloud_name: "dnuxz94n5",
  api_key: "389922721934524",
  api_secret: process.env.CLOUDINARY_SECRET,
})

async function getCloudinaryUrl(folder, filename) {
  const publicId = `raree-show/${folder}/${filename}`
  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: "auto",
    quality: "auto",
  })
}

async function main() {
  // 1. 更新地图路径
  const mapUrl = await getCloudinaryUrl("maps", "westeros")
  console.log("Map URL:", mapUrl)

  // 2. 生成所有角色的 URL 映射
  const characters = JSON.parse(fs.readFileSync("./data/characters.json", "utf-8"))
  const urlMap = {}

  for (const char of characters) {
    urlMap[char.id] = await getCloudinaryUrl("characters", char.id)
  }

  // 3. 保存映射文件供 data.ts 使用
  fs.writeFileSync(
    "./data/portrait-urls.json",
    JSON.stringify(urlMap, null, 2),
    "utf-8"
  )
  console.log(`Generated URLs for ${Object.keys(urlMap).length} characters`)
  console.log("Saved to data/portrait-urls.json")
}

main()