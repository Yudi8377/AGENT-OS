# Agent OS

**Unified AI Agent Platform** — satu tempat untuk menemukan tools AI, mengelola skills, membangun agent, merancang workflow, menjalankan agent secara terisolasi, serta mengevaluasi dan mengaudit hasilnya.

> Status: fondasi aplikasi dan arsitektur awal. Runtime produksi, konektor model, eksekusi terisolasi, serta penyimpanan persisten harus dikonfigurasi sebelum dipakai untuk tugas nyata.

## Modul produk

1. **AI Directory** — direktori tools, framework, dan agent; pencarian, kategori, sumber, serta status lisensi.
2. **Skills Studio** — katalog skill, validasi metadata, pratinjau, dan proses pemasangan yang eksplisit.
3. **Agent Builder** — konfigurasi identitas agent, instruksi, model, tools, dan kebijakan.
4. **Orchestrator** — rancangan workflow dan kolaborasi multi-agent.
5. **Secure Runtime** — batas eksekusi, izin minimum, manajemen secret, dan isolasi sandbox.
6. **Evaluation & Audit** — test cases, evaluasi hasil, jejak aktivitas, biaya, dan pemantauan.
7. **Workspace & Governance** — ruang kerja, akses berbasis peran, persetujuan, serta audit perubahan.

## Sumber referensi

- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — repositori berlisensi MIT pada tingkat repositori; setiap skill tetap perlu pemeriksaan lisensi sumber.
- [e2b-dev/awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents) — repositori berlisensi CC BY-NC-SA 4.0; materi berlisensi tersebut tidak boleh diasumsikan cocok untuk penggunaan komersial.
- [ai-collection/ai-collection](https://github.com/ai-collection/ai-collection) — repositori berlisensi MIT pada tingkat repositori; periksa lisensi aset/tautan pihak ketiga secara terpisah.

Agent OS menggunakan tautan sumber dan metadata seperlunya, bukan menyalin seluruh katalog secara otomatis. Lisensi katalog, skill, kode, model, dan layanan pihak ketiga dicatat secara terpisah.

## Prinsip keamanan

- Jangan menaruh API key atau secret di kode klien maupun Git.
- Jangan menjalankan kode atau skill pihak ketiga secara otomatis tanpa pemeriksaan dan persetujuan.
- Runtime harus menggunakan sandbox, batas resource, izin minimum, dan log audit.
- Data pengguna/workspace harus dipisahkan; tindakan sensitif perlu otorisasi server.
- Semua status demo harus dibedakan dari koneksi runtime produksi.

## Menjalankan antarmuka lokal

```bash
npm install
npm run dev
```

Pemeriksaan produksi:

```bash
npm run build
npm run preview
```

## Tahapan implementasi

- **Fondasi UI:** navigasi modul, direktori contoh, pencarian, dan alur pembuatan agent lokal.
- **Data layer:** skema persisten, workspace, pengguna, RBAC, dan audit.
- **Integrasi katalog:** sinkronisasi metadata sumber dengan provenance dan lisensi.
- **Agent runtime:** provider model dan tool registry dengan izin yang dibatasi.
- **Orkestrasi:** workflow runner, state, retry, dan approval gate.
- **Evaluasi & operasi:** pengujian, observabilitas, budget controls, dan hardening.

Antarmuka awal tidak mengklaim agent benar-benar berjalan sampai runtime dan kredensial provider disambungkan dengan aman.
