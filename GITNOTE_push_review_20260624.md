## Push Review Note

Date: 2026-06-24

Checkpoint commit:

- `8bfd127e` - `checkpoint widget abstraction work`

This note records content in the current local history that should be reviewed before pushing to a public or shared remote.

### High-risk content currently included

- `apps/widgetva-system/.env.local`
  - Local environment file.
  - Should be removed from git history before public push unless intentionally sanitized.

- `apps/widgetva-system/node_modules/`
  - Installed dependency artifacts.
  - Should not be versioned.

- `frontend/node_modules/`
  - Installed dependency artifacts.
  - Should not be versioned.

### Large/generated content to review

- `apps/widgetva-system/dist/`
  - Build output.
  - Usually should not be versioned unless the repo intentionally publishes built assets.

- `packages/agent_widget_ui/dist/`
  - Build output.
  - Usually should not be versioned unless intentionally publishing compiled assets in-repo.

- `.vite` caches under dependency folders
  - Generated cache artifacts.
  - Should not be versioned.

### Content that is usually fine to keep

- `package-lock.json`
- `frontend/package-lock.json`
- `packages/agent_widget_ui/package-lock.json`
- `templates/host_va_react/package-lock.json`

These lockfiles are normal to version if the corresponding package folders are part of the repo.

### Recommended next step before push

If this repo is going to be pushed to a new remote for the widget abstraction work:

1. remove tracked `.env.local`
2. remove tracked `node_modules/`
3. review whether built `dist/` artifacts belong in the repo
4. then create a cleaned follow-up commit, or export a clean new repository
