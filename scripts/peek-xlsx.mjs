// Usage: node scripts/peek-xlsx.mjs <file.xlsx> [rows]
import ExcelJS from "exceljs";

const [file, n = "4"] = process.argv.slice(2);
const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { worksheets: "emit", sharedStrings: "cache" });
for await (const ws of reader) {
  console.log(`--- sheet: ${ws.name ?? ws.id}`);
  let i = 0;
  for await (const row of ws) {
    console.log(JSON.stringify(row.values.slice(1)));
    if (++i >= Number(n)) break;
  }
}
