# 🎮 Kube Tetris

A Kubernetes-themed Tetris game that teaches pod orchestration and cluster management concepts through interactive gameplay.

![Kube Tetris](https://img.shields.io/badge/Game-Kube%20Tetris-blue?style=for-the-badge&logo=kubernetes)

## 🎯 Game Overview

Kube Tetris combines the classic Tetris gameplay with real Kubernetes concepts. Players must strategically place falling pods into clusters while adhering to Kubernetes constraints like resource limits, affinity rules, and taints/tolerations.

## 🚀 Features

### Core Gameplay
- **Pod Management**: Different pod types (Frontend, Backend, Database, Cache, Monitor) with unique characteristics
- **Cluster Organization**: 4 clusters at the bottom of the play area with 3 nodes each
- **Real K8s Constraints**: Resource limits, pod affinity/anti-affinity, node taints and tolerations
- **Dependency Management**: Pods have dependencies on other pods (e.g., Backend depends on Database)

### Kubernetes Concepts Implemented
- **Resource Management**: CPU and memory constraints for pods
- **Pod Affinity**: Rules that determine where pods should be placed relative to other pods
- **Node Taints & Tolerations**: Some nodes have taints (GPU, SSD, dedicated, spot) that only certain pods can tolerate
- **Cluster Constraints**: Anti-affinity rules and resource quotas
- **Dependencies**: Inter-pod dependencies that affect scoring

### Scoring System
- **Base Points**: 100 points per pod placement
- **Optimal Placement Bonus**: Up to 500 points for strategic placement
- **Constraint Compliance**: 100 points per satisfied constraint
- **Dependency Bonus**: 150 points per satisfied dependency
- **Distribution Bonus**: 200 points for spreading databases across clusters
- **Line Clear**: 400 points per completed line
- **Level Multiplier**: Score multiplied by current level

### Game Features
- **Progressive Difficulty**: Speed increases with level
- **High Score Board**: Local storage-based leaderboard (top 10)
- **Real-time Constraints**: Dynamic constraint generation
- **Visual Feedback**: Color-coded pods and cluster boundaries
- **Responsive Design**: Works on desktop and mobile devices

## 🎲 Pod Types

| Type | Symbol | Color | Resources | Dependencies | Special Properties |
|------|--------|-------|-----------|--------------|-------------------|
| Frontend | F | Red | 1 CPU, 2GB RAM | Backend | Tolerates spot instances |
| Backend | B | Blue | 2 CPU, 4GB RAM | Database, Cache | Requires database affinity |
| Database | D | Green | 3 CPU, 6GB RAM | None | Anti-affinity (spread apart) |
| Cache | C | Orange | 1 CPU, 3GB RAM | None | Prefers SSD nodes |
| Monitor | M | Purple | 1 CPU, 1GB RAM | None | Tolerates all node types |

## 🎮 Controls

- **←/→**: Move pod left/right
- **↑**: Rotate pod
- **↓**: Soft drop (faster descent)
- **Space**: Pause/Resume game

## 🏆 Scoring Strategy

To achieve high scores:

1. **Satisfy Dependencies**: Place dependent pods near their requirements
2. **Spread Databases**: Distribute database pods across different clusters
3. **Follow Constraints**: Adhere to active constraints for bonus points
4. **Optimize Clusters**: Create balanced clusters with multiple pod types
5. **Clear Lines**: Fill complete rows for substantial point bonuses

## 🚀 Deployment to GitHub Pages

1. **Fork/Clone** this repository
2. **Enable GitHub Pages** in repository settings
3. **Select source** as main branch / root folder
4. **Access your game** at `https://yourusername.github.io/kubetetris`

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/kubetetris.git

# Navigate to directory
cd kubetetris

# Serve locally (any static server works)
python -m http.server 8000
# or
npx serve .
# or simply open index.html in your browser
```

## 📁 Project Structure

```
kubetetris/
├── index.html          # Main game page
├── styles.css          # Game styling
├── game.js             # Game logic and mechanics
└── README.md           # This file
```

## 🎯 Educational Value

This game teaches several important Kubernetes concepts:

- **Resource Management**: Understanding CPU/memory limits
- **Pod Scheduling**: How Kubernetes places pods on nodes
- **Affinity Rules**: Controlling pod placement relationships
- **Taints and Tolerations**: Node specialization and pod placement
- **Cluster Architecture**: Understanding multi-node clusters
- **Dependency Management**: Service interdependencies

## 🤝 Contributing

Contributions are welcome! Some ideas for enhancements:

- **New Pod Types**: Add more specialized pod types
- **Advanced Constraints**: Implement more complex K8s rules
- **Networking**: Add service mesh concepts
- **Monitoring**: Add observability mechanics
- **Multi-cluster**: Expand to multiple clusters
- **Disaster Recovery**: Add failure scenarios

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🎮 Play Now!

Experience Kubernetes orchestration through gaming: [Play Kube Tetris](https://yourusername.github.io/kubetetris)

---

Made with ❤️ for the Kubernetes community. Happy orchestrating! 🎯
