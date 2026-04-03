# Ronald Hoang | Software Engineer
### AI • Embedded Systems • Sensor Fusion

Welcome to my portfolio. I am a Software Engineer focused on the intersection of hardware and intelligent software. My work ranges from high-performance embedded systems to AI-driven creative production and secure API integrations.

---

## Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Languages** | C++ (11/14/17), Python, SQL |
| **Embedded & Systems** | ARM Cortex, Sensor Fusion, Motion Sensing, RTOS, YANG Data Modeling |
| **AI & Machine Learning** | Gemini API, Veo, Lyria, RAG, Multi-Agent Orchestration, LLMs, Voice Synthesis, Computer Vision |
| **Cloud & Infrastructure** | AWS, GCP, Terraform, Docker, Kubernetes, CI/CD, Jenkins, Linux |
| **Big Data** | Databricks, Delta Lake, Redis, Lakehouse Architecture |
| **Web & APIs** | Next.js, GSAP (Scroll + Particle Animations), Firebase, Veryfi APIs, Node.js |
| **Dev Tools** | GDB, Valgrind, Git, CMocka, REST/RPC APIs, Observability |

---

## Featured Projects

### AI Film Production Pipeline
A fully autonomous multi-agent film production system built on GCP.
* **Key Features:** Centralized command agent with deterministic routing, RAG architecture layer, proprietary Vocal DNA system for persistent identity across generative outputs.
* **Tech:** Python, Gemini, Veo, Lyria, GCP, multi-agent orchestration.
* **Challenge:** Synchronizing AI-generated visual, audio, and narrative assets into a cohesive, repeatable pipeline.

### Intelligent Document Processing (IDP) Dashboard
A secure web application for high-speed KYC and document classification.
* **Key Features:** Real-time receipt validation, ID card verification using Veryfi Lens SDK, multimodal classification, and cross-referencing government-issued credentials against financial records.
* **Tech:** Next.js, Veryfi APIs, Firebase.
* **Focus:** Robust error handling for OCR edge cases and data privacy for sensitive financial documents.

### Carrier-Grade Network Infrastructure
Embedded systems engineering for a classified network infrastructure product serving 350+ global operators (AT&T, Meta, Verizon).
* **Key Features:** Lock-free logging subsystem using atomic ring buffers and mmap-based persistence (eliminated data loss, 95% latency reduction). Tiered RBAC using Composite design pattern with dynamic command visibility by operator clearance level.
* **Tech:** C++, Python, YANG, CI/CD pipelines, CMocka.
* **Scale:** 85%+ code coverage across multiple repositories; triaged 100+ protocol-level incidents per quarter.

---

## About This Portfolio

This site is built to reflect the same performance standards as the systems I develop.

* **Framework:** Next.js (React) with TypeScript
* **Animations:** GSAP ScrollTrigger — scroll-controlled frame sequences, particle/spark systems, laser beam effects, and text animations
* **Audio:** Web Audio API — synchronized soundtrack with intro/loop playback, spatial sound effects (laser charge, fire, text thud)
* **Assets:** Two scroll-driven PNG frame sequences (Hero: 144 frames; Cyborg spin: 285 frames), video loop backgrounds
* **Hosting:** Google Cloud Platform (Firebase)

---

## Frame Sequence Animation Setup

This project uses scroll-controlled image sequences (not WebM/GIF) for precise frame-by-frame control.

### Hero Landing Frames
- Directory: `public/assets/hero_landing_frames_nobg/`
- Override with env variable: `NEXT_PUBLIC_FRAME_BASE_URL`
- Naming: `ezgif-frame-001.png`, `ezgif-frame-002.png`, ...
- Total: 144 frames (6 seconds at 24 fps)

### Cyborg Spin Frames
- Directory: `public/assets/cyborg-frames/`
- Naming: `frame_0001.png`, `frame_0002.png`, ...
- Total: 285 frames (first 2 are static hold frames, 283 are spinning)

> All frame directories, source videos, and the spin ZIP are excluded from Git via `.gitignore`. To run locally, populate these directories manually or set `NEXT_PUBLIC_FRAME_BASE_URL` to point at a CDN. To request access to the asset files, email [rpchoang@gmail.com](mailto:rpchoang@gmail.com).
