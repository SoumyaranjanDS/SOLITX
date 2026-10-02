# SOLITX — The Automated CI/CD Buffer Strategy

To maintain a flawless 77-day public streak while safely working ahead (building a buffer), we are leveraging a strict Git branching strategy tied directly to a CI/CD deployment pipeline.

## 1. The Strategy: One Branch Per Day
There will be no manual copying/pasting of drafts. The entire system (Main Project + Case Study Website) will be deployed automatically via CI/CD whenever `main` is updated.

- **`main` branch:** This is production. It represents the *current public day*.
- **Feature Branches:** For every day of the roadmap, we create a dedicated branch (e.g., `git checkout -b day-04`).

## 2. The Dual-Repository Development Workflow
Your SOLITX ecosystem is split into two independent repositories, both tied to their own CI/CD pipelines.

1. You checkout a new branch in BOTH repositories (e.g., `git checkout -b day-04`).
2. **In `SOLITX_PROJECT` (Main Repo):**
   - Build Backend APIs and Frontend UI updates.
   - Update architecture diagrams in `SOLITX_PROJECT/docs/architecture/`
   - Create ADRs in `SOLITX_PROJECT/docs/decisions/`
   - Log daily progress in `SOLITX_PROJECT/docs/progress/`
3. **In `SOLITX_CASE_STUDY` (Documentation Repo):**
   - Create the Case Study documentation page (`src/pages/Day4.jsx`).
   - Any images, charts, or screenshots generated for this day are placed into `SOLITX_CASE_STUDY/public/media/day-04/`. This allows your React UI to natively serve the media.
4. You commit and push the `day-04` branches to their respective GitHub repos.

## 3. The Public Release Workflow (The Daily Drop)
When you wake up and it is time to publicly publish "Day 4":
1. You go to GitHub and merge the `day-04` branch into `main`.
2. Your CI/CD pipelines (e.g., Vercel, GitHub Actions, Render) instantly detect the merge to `main`.
3. The CI/CD automatically builds and deploys both the **SOLITX Main App** and the **SOLITX Case Study UI**.
4. You copy your pre-written LinkedIn post and publish it.

### Why this is perfect:
- **Zero Deployment Stress:** You never touch a server manually. Merging triggers the world.
- **Perfect History:** Your GitHub history looks immaculate, with one clean pull request/merge per day.
- **The Ultimate Buffer:** You can be working on the `day-10` branch locally, while the public CI/CD is only deploying `day-04`. If you take a week off, you just click "Merge" on GitHub once a day from your phone.
