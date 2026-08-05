# iDash — Smart Factory · Sugar Mill (Mitr Lao)

แดชบอร์ดติดตามกระบวนการผลิตน้ำตาลแบบไฟล์เดียว (single-file HTML) เปิดออฟไลน์ได้
ดึงข้อมูลสดจาก Google Apps Script (ML Dashboard) และรับข้อมูลกรอกมือจาก staff

## ไฟล์

- **`idash_smart_monitoring.html`** — ตัวแดชบอร์ดหลัก (HTML/CSS/JS ในไฟล์เดียว · ฟอนต์+ไอคอนฝัง base64 · เปิดจากไฟล์ `file://` ได้เลย)
- **`iDash_AppsScript.gs`** — Apps Script สำหรับรับข้อมูลที่ staff กรอก แล้วเขียนลง Google Sheets (แยกแท็บรายสถานี)

## สถานีที่ครอบคลุม

1. **หีบอ้อย (Milling)** — 12 พารามิเตอร์ ค่าควบคุม 4 โซน · บันไดการสกัด
2. **หม้อต้ม (Clarification & Evaporation)** — 14 พารามิเตอร์ตาม QC plan สถานี
3. **เคี่ยว (Pan Boiling)** — 22 พารามิเตอร์ A/B/C + สายทำความเย็น C-Molasses
4. **ปั่นแยก (Centrifugal)** — 20 พารามิเตอร์ (ดึงสดทั้งหมด) ตามไฮไลท์ในไฟล์ Centrifugal.xlsx · ผลผลิตน้ำตาล/โมลาสสุดท้าย/Purity Rise รายสาย/แมกม่า/น้ำตาล B-C
5. **หม้อไอน้ำ + ผลิตไฟฟ้า (Boiler & Power)** — 26 พารามิเตอร์ · เคมีน้ำ/สารเคมี/โหลด/พลังงาน

## ความสามารถ

- ดึงข้อมูลสดจาก ML Dashboard + แคชออฟไลน์ + ดูย้อนหลังรายวัน
- KPI โดนัท · กราฟแนวโน้ม (today / to-date / target) · ตารางข้อมูลสลับได้ · บันทึกเป็นรูป PNG
- บทวิเคราะห์ RCA (ราก → ทางแก้ → ตามต่อ) จากหลักการ Peter Rein
- โมเดลผลกระทบระดับโรงงาน (Plant-Level Impact) แปลงค่าที่หลุดเป้าเป็นปริมาณจริง
- Light / Dark mode · ดีไซน์ระดับผู้บริหาร · Content-Security-Policy กันสคริปต์แปลกปลอม

## หมายเหตุ

ค่าเป้าและ benchmark บางส่วนอ้างอิง Peter Rein — Cane Sugar Engineering และค่าออกแบบโรงงาน
ต้องให้โรงงานยืนยันก่อนใช้ตัดสินใจจริง
