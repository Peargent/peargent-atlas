# Peargent Atlas

A Next.js application for visualizing agent architectures using interactive graph visualizations.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Interactive graph visualization of agent architectures
- Import and export `.pear` files
- Multi-tab interface for managing multiple agent configurations
- Download visualizations as PNG images
- Responsive design with mobile support
- Dark/light theme support

## Tech Stack

- **Next.js 15** - React framework
- **React Flow** - Graph visualization
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **TypeScript** - Type safety
- **Dagre** - Graph layout algorithm

## Project Structure

```
├── app/
│   ├── page.tsx          # Main application page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── AtlasGraph.tsx    # Graph visualization component
│   ├── AtlasSidebar.tsx  # Sidebar navigation
│   ├── CustomNodes.tsx   # Custom node components
│   ├── layout.ts         # Graph layout logic
│   ├── theme-toggle.tsx  # Theme switcher
│   └── ui/
│       └── Toast.tsx     # Toast notification component
└── lib/
    └── cn.ts             # Utility functions
```

## Building for Production

```bash
npm run build
npm start
```

## License

MIT
