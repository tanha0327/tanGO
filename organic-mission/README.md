# Organic Mission (staging)

This prototype lives on the `staging` branch in `organic-mission/`. It is separate from tanGO's current root application.

## Test locally

Serve this directory as a static site:

```sh
python3 -m http.server 4173 --directory organic-mission
```

Then open http://localhost:4173.

## GitHub checks

Pushes to `staging` run the `Staging checks` workflow, which checks the JavaScript syntax and uploads the static site as the `organic-mission-staging` artifact. The workflow uses the GitHub Actions `staging` environment.

The repository's GitHub Pages site serves a single production URL. This setup leaves that setting alone; the Actions artifact is the safe review package for staging, not a second public Pages URL.
