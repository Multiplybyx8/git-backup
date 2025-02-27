# System Backup git Auto (33322 -> 33776)

ตั้งค่า Google Cloud Platform (GCP)

1.ไปที่ Google Cloud Console → https://console.cloud.google.com/welcome?project=bot-dialogflow-161e9
2.ไปที่ APIs & Services → เลือก Credentials
3.คลิก Create Credentials → Service account
4.ตั้งค่า Service Account Name, กด Create & Continue
5.เลือก Role → Owner
ุุ6.กด Create Key → เลือก JSON → ดาวน์โหลดไฟล์
7.นำไฟล์ JSON มาไว้ที่โปรเจค → ตั้งชื่อเป็น your-service-account.json

Create Folder Google Drive
Manage access -> can edit

ฺBackup file Github → Google Drive (Auto)

---

ส่วนของ GCP
ตั้งค่า Google Cloud Platform (GCP)
1.ไปที่ Google Cloud Console → https://console.cloud.google.com/welcome?project=bot-dialogflow-161e9
2.ไปที่ APIs & Services → เลือก Credentials
3.คลิก Create Credentials → Service account
4.ตั้งค่า Service Account Name, กด Create & Continue
5.เลือก Role → Editor หรือ Owner
ุุ6.กด Create Key → เลือก JSON → ดาวน์โหลดไฟล์ (.json)

---

ส่วนของ Google Drive
ตั้งค่า Google Drive (Add Folder)
1.ไปที่ Google Drive → สร้าง Folder ใหม่
2.ในหน้า Folder มุมขวาบน ตรงตัว i ในวงกลม กดคลิก Manage Accress → ตรง General accress เลือกเป็น Editor 3. copy → url

---

ส่วนของ Github
Transfer Git Repo

- Transfer repo: git-backup (รับ Invite)
- Create Accress Token → ใช้ตัวเดีนวกับ Token ที่ชื่อ x8-webhook กด edit แล้วเพื่ม repo: git-backup ใน Only select repositories \*ใช้ตัวเดียวกันจะได้ไม่ต้องสร้างตัวใหม่
- รบกวนเช็ค Token: hook-git-api ว่าเลือกเป็น All repositories ไว้หรือไม่ และ ตรง Repository permissions > Webhooks เป็น เลือกเป็น Read-only
