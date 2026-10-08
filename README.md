# Agent OS

**Unified AI Agent Platform** — satu tempat untuk menemukan tools AI, mengelola skills, membangun agent, merancang workflow, menjalankan agent secara terisolasi, serta mengevaluasi dan mengaudit hasilnya.

> Status: aplikasi web sudah dipublikasikan melalui GitHub Pages; Supabase Auth/database, workspace RBAC, alur persetujuan agent, riwayat run, dan Edge Function `agent-run` telah disiapkan. Eksekusi model memerlukan secret server `OPENAI_API_KEY`; sandbox/tools eksternal belum tersedia.

**Live app:** https://yudi8377.github.io/AGENT-OS/  
**Repository:** https://github.com/Yudi8377/AGENT-OS  
**Supabase:** https://supabase.com/dashboard/project/tgicltoykzpsridyhvci

## Status implementasi saat ini

- Supabase project: `tgicltoykzpsridyhvci` (region Singapore).
- Tabel inti dengan RLS: `profiles`, `workspaces`, `workspace_members`, `agents`, `audit_events`, `agent_runs`.
- Workspace dibuat secara atomik melalui RPC `create_workspace`; profil dan timestamp dikelola database.
- Status agent: Draft → Review → Approved; hanya Owner/Admin dapat menyetujui atau menonaktifkan agent.
- Edge Function `agent-run` memvalidasi JWT, keanggotaan workspace, peran, dan status persetujuan. Ia hanya menjalankan panggilan model OpenAI tanpa tools; jika secret/provider belum siap, run ditandai blocked.
- Untuk aktivasi model: tambahkan `OPENAI_API_KEY` pada Supabase → Project Settings / Edge Functions → Secrets. Jangan menaruh key di frontend atau Git. Panggilan model dapat menimbulkan biaya pada akun provider.
- Konfigurasikan Supabase Auth URL Configuration: Site URL `https://yudi8377.github.io/AGENT-OS/` dan Redirect URL `https://yudi8377.github.io/AGENT-OS/**` agar konfirmasi email kembali ke aplikasi.
- Belum siap untuk produksi penuh: belum ada sandbox eksekusi kode, tool registry, rate limiting berbasis kuota, workflow runner, evaluasi otomatis, dan pengujian penetrasi independen. Gunakan status ini sebagai limited beta, bukan layanan produksi kritis.

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

- **Selesai — web deployment:** GitHub Pages dengan build CI otomatis.
- **Selesai — data layer dasar:** skema persisten, workspace, pengguna, RBAC, dan audit.
- **Selesai — agent lifecycle dasar:** Draft → Review → Approved, serta riwayat run.
- **Terpasang — model runtime terbatas:** Edge Function memanggil OpenAI tanpa tools ketika secret/provider tersedia.
- **Berikutnya — katalog:** sinkronisasi metadata dengan provenance dan pemeriksaan lisensi.
- **Berikutnya — Orchestrator:** workflow runner, state, retry, dan approval gate.
- **Berikutnya — evaluasi & operasi:** pengujian, observabilitas, budget controls, sandbox, dan hardening.

Antarmuka awal tidak mengklaim agent benar-benar berjalan sampai runtime dan kredensial provider disambungkan dengan aman.
