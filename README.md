# Ronald Hoang | Software Engineer 
### AI • Embedded Systems • Sensor Fusion

Welcome to my portfolio. I am a Software Engineer focused on the intersection of hardware and intelligent software. My work ranges from high-performance embedded systems to AI-driven creative production and secure API integrations.

---

## 🛠 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Embedded & Systems** | C, C++, ARM Cortex, Sensor Fusion, Motion Sensing, RTOS |
| **AI & Machine Learning** | LLMs (Character Gen), Voice Synthesis, Environment Creation, Computer Vision |
| **Web & APIs** | Next.js, GSAP (Scroll Animations), Firebase, Veryfi APIs, Node.js |
| **Tools & DevOps** | GCP, Git, Docker, CI/CD, Linux |

---

## 🌟 Featured Projects

### 🎬 AI-Driven Horror Production Studio
A full-stack system that leverages generative AI to automate horror content creation.
* **Key Features:** Automated character profile generation, realistic voice synthesis, and dynamic environment rendering.
* **Tech:** Python, LLMs, TTS APIs, Stable Diffusion, Node.js.
* **Challenge:** Synchronizing AI-generated assets into a cohesive narrative structure.

### 📄 Intelligent Document Processing (IDP) Dashboard
A secure web application demonstrating high-speed KYC and document classification.
* **Key Features:** Real-time receipt validation and ID card verification using Veryfi Lens SDK.
* **Tech:** Next.js, Veryfi APIs, Firebase.
* **Focus:** Implementing robust error handling for OCR and data privacy for bank statements.


---

## 🎨 About This Portfolio
This site is built to be as high-performance as the systems I develop.
* **Framework:** Next.js (React)
* **Animations:** GSAP ScrollTrigger for hardware-style visual storytelling.
* **Hosting:** Google Cloud Platform (Firebase)
* **Performance:** Optimized for 100/100 Lighthouse scores.

---

## 🎞 Frame Sequence Animation Setup (Hero)

- This project uses a scroll-controlled image sequence (not webm/gif) for smooth frame-by-frame control.
- Place your frames in `public/assets/hero_landing_frames/` or use a CDN with env variable `NEXT_PUBLIC_FRAME_BASE_URL`.
- Frame naming format: `ezgif-frame-0001.png`, `ezgif-frame-0002.png`, ...
- In code: `src={`${frameBaseUrl}/ezgif-frame-${String(index+1).padStart(4, '0')}.png`}`.
- Avoid committing large frame directories to Git; use remote storage/CDN for production and only small sample frames in repo.


