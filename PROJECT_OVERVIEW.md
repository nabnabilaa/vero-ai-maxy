# AI Vero - Project Overview

## 📌 1. Project Apa Ini? (What is this project?)
**AI Vero** (atau *AI Studio Applet*) adalah sebuah platform/Sistem Manajemen Agen AI (AI Agent Management System) berbasis web. Platform ini didesain untuk membantu pengguna (seperti bisnis atau startup) dalam **membuat, mengelola, dan berinteraksi dengan Agen AI kustom**.

Fitur-fitur utama dari project ini (berdasarkan riwayat dan struktur yang ada) meliputi:
- **Guided AI Agent Creation**: Pembuatan agen AI yang dipandu dengan UI yang modern (termasuk upload file dan *knowledge base*).
- **Knowledge Management System**: Sistem pengetahuan berbasis dua tingkat (pengetahuan umum perusahaan dan pengetahuan spesifik per agen).
- **Interactive Chat & Voice Calls**: Agen tidak hanya bisa merespons via teks (Markdown, klik tautan) tetapi juga dapat dihubungkan ke panggilan suara.
- **Location & Place Integration**: Integrasi dengan API Overpass (OpenStreetMap) untuk memberikan rekomendasi tempat atau peta interaktif.
- **Bilingual & Modern Landing Page**: Mendukung pergantian bahasa (Bilingual Module dengan ikon bendera) serta memiliki UI halaman utama (*Landing Page*) bertema modern SaaS/startup dengan animasi dinamis.

---

## 💻 2. Bahasa Pemrograman & Stack Teknologi (What Language/Tech Stack?)
Project ini dibangun dengan arsitektur **Fullstack JavaScript/TypeScript** melalui ekosistem **Next.js**.

- **Framework Utama**: Next.js 15 (App Router)
- **Bahasa**: TypeScript & JavaScript
- **Frontend / UI**: 
  - React 19
  - Tailwind CSS 4 & PostCSS (untuk *styling* modern)
  - Framer Motion (`motion`) (untuk animasi dinamis dan transisi)
  - Zustand (untuk *state management*)
  - React Hook Form & Zod (untuk validasi form)
- **Backend / API**:
  - API Routes Next.js
  - Database: **MySQL** (diakses menggunakan driver `mysql2`)
  - AI Engine: **Google Gemini API** (`@google/genai`) dan **Groq API**
- **Utilitas Tambahan**: 
  - `cheerio`, `puppeteer`, `pdf-parse` (untuk *scraping*/ekstraksi *knowledge base*)
  - `bcryptjs` (untuk enkripsi kata sandi)
  - `uuid` (untuk penamaan identitas unik)

---

## 🎯 3. Apa Tujuannya? (What is its purpose?)
Tujuan utama aplikasi ini adalah untuk **menyediakan solusi AI untuk bisnis** dengan cara yang mudah.
- Mengubah *knowledge* perusahaan (dokumen, FAQ, info bisnis) menjadi agen AI yang pintar.
- Mengurangi kebutuhan *Customer Service* manual karena agen AI mampu menjawab pertanyaan pelanggan dengan tepat dan sopan.
- Memberikan jawaban yang akurat (atau jujur jika tidak tahu, lalu mencatatnya di sistem monitoring backend/admin).
- Memberikan visualisasi modern yang menarik pada *Landing Page* untuk menarik calon pengguna berbayar (*SaaS platform*).

---

## 🚀 4. Cara Membuat / Menjalankannya (How to build/run it?)
Untuk menjalankan project ini secara lokal di komputermu, ikuti langkah-langkah berikut:

### Persyaratan Sistem (Prerequisites):
- **Node.js** (Minimal versi 20 ke atas)
- **Koneksi Internet** (Untuk akses API AI dan install NPM)
- **Server Database** MySQL lokal (misal: berjalan di XAMPP / Laragon).

### Langkah Menjalankan:

1. **Buka Terminal** dan pastikan sedang berada di direktori project:
   ```bash
   cd "C:\laragon\www\ai vero"
   ```

2. **Install Dependensi NPM**:
   ```bash
   npm install
   ```

3. **Pastikan Database Menyala**:
   Gunakan Laragon atau aplikasi serupa untuk memastikan MySQL berjalan di `localhost:3306`, dan sudah mempunyai *database* bernama `ai_vero`.
   - Lakukan migrasi atau impor skema database jika diperlukan.

4. **Konfigurasi Environment**:
   Pastikan file `.env.local` memiliki kredensial API yang valid:
   ```env
   GEMINI_API_KEY=Kunci_API_Gemini_Kamu
   GROQ_API_KEY=Kunci_API_Groq_Kamu
   APP_URL=http://localhost:3000
   
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASS=
   DB_NAME=ai_vero
   ```

5. **Jalankan Aplikasi dalam Mode '*Development*'**:
   ```bash
   npm run dev
   ```

6. **Buka di Browser**:
   Buka [http://localhost:3000](http://localhost:3000) di browsermu untuk melihat aplikasinya berjalan.
