# zzziiyy.github.io

Personal website built with [Hugo](https://gohugo.io/) and the [Anatole](https://github.com/lxndrblz/anatole) theme. Deployed on GitHub Pages via GitHub Actions.

## Local development

**Prerequisites:** Hugo Extended v0.145.0+

```bash
# Clone with submodules (for the theme)
git clone --recurse-submodules https://github.com/zzziiyy/zzziiyy.github.io.git
cd zzziiyy.github.io

# Start dev server (includes draft content)
hugo server -D
```

Site runs at `http://localhost:1313/`.

## Adding content

```bash
# New blog post
hugo new post/my-post.md

# New note
hugo new notes/my-note.md

# New experiment
hugo new experiments/my-experiment.md
```

Set `draft: false` in the frontmatter when ready to publish.

## Structure

```
.
├── content/
│   ├── _index.md          # Homepage intro
│   ├── about.md           # About page
│   ├── cv.md              # CV / Resume
│   ├── contact.md         # Contact page
│   ├── post/              # Blog posts
│   ├── notes/             # Short notes and references
│   ├── experiments/       # Experiment writeups
│   └── portfolio/         # Projects index page
├── data/
│   └── portfolio.yml      # Projects data for portfolio layout
├── static/
│   └── images/
│       └── profile.jpg    # Your profile picture (add this!)
├── .github/workflows/
│   └── hugo.yml           # GitHub Actions deployment
└── hugo.toml              # Site configuration
```

## Profile picture

Add your photo at `static/images/profile.jpg`. The Anatole theme displays it in the sidebar.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow, which builds and deploys to GitHub Pages automatically.

**First-time setup:**
1. Go to repository Settings → Pages
2. Set source to "GitHub Actions"
3. Push to `main`

## Theme updates

The Anatole theme is a git submodule:

```bash
git submodule update --remote themes/anatole
git add themes/anatole
git commit -m "Update Anatole theme"
```

## Customization

- **Site config**: `hugo.toml` — title, description, social links, menu
- **Projects**: `data/portfolio.yml` — add/edit project entries
- **Profile picture**: `static/images/profile.jpg`
- **Custom CSS**: add files to `static/css/`, reference in `hugo.toml` under `customCss`
