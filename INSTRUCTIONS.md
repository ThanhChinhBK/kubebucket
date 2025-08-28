# Kube Tetris - Game Instructions

## 🎯 Objective
Manage Kubernetes pods by placing them optimally on nodes while respecting resource constraints and maintaining cluster health.

## 🎮 How to Play

### Basic Mechanics
- **Single Pod Drops**: One pod falls at a time from the top
- **5 Nodes**: Bottom row contains 5 nodes acting as resource buckets
- **Resource Management**: Each node has limited CPU and memory
- **Pod Placement**: Pods stack vertically above nodes

### Controls
- **←/→ Arrow Keys**: Move pod left/right
- **↑ Arrow Key**: Rotate pod (currently single pods only)
- **↓ Arrow Key**: Soft drop (faster descent)
- **Spacebar**: Pause/Resume game

## 📊 Resource System

### Node Resources
Each node displays:
- **CPU**: Available/Total CPU cores
- **RAM**: Available/Total memory (GB)
- **Node ID**: N0, N1, N2, N3, N4
- **Status Bar**: Visual resource usage indicator
- **Taints**: Special node properties (if any)

### Pod Resources
Each pod shows:
- **Type**: Frontend (F), Backend (B), Database (D), Cache (C), Monitor (M)
- **CPU**: Required CPU cores
- **RAM**: Required memory (GB)
- **Symbol**: Letter identifier
- **Color**: Type-specific color coding

## 🚀 Pod Types & Resources

| Type | Symbol | CPU | Memory | Dependencies | Special Properties |
|------|--------|-----|--------|--------------|-------------------|
| Frontend | F | 1 | 2GB | Backend | Can use spot instances |
| Backend | B | 2 | 4GB | Database, Cache | Needs database proximity |
| Database | D | 3 | 6GB | None | Should be distributed |
| Cache | C | 1 | 3GB | None | Prefers SSD storage |
| Monitor | M | 1 | 1GB | None | Can run anywhere |

## 🎯 Scoring System

### Base Points
- **100 points** per successful pod placement

### Bonus Points
- **150 points** for balanced resource utilization
- **200 points** for good load distribution across nodes
- **100 points** per satisfied constraint
- **400 points** per completed line clear
- **Level multiplier** applies to all scores

### Optimal Strategies
1. **Balance Resources**: Distribute pods evenly across nodes
2. **Avoid Overload**: Don't exceed 90% resource usage on any node
3. **Satisfy Dependencies**: Place dependent services in the cluster
4. **Respect Constraints**: Follow taint/toleration rules
5. **Clear Lines**: Fill complete horizontal rows for big bonuses

## ⚠️ Constraints & Rules

### Resource Constraints
- Pods cannot be placed if node lacks sufficient CPU or memory
- Resource usage is tracked in real-time
- Overloaded nodes (>80% usage) show red status

### Kubernetes Constraints
- **Taints/Tolerations**: Some nodes have special requirements
- **Anti-Affinity**: Database pods prefer separation
- **Dependencies**: Services need their dependencies available

### Game Over Conditions
- Cannot place pod due to resource constraints
- Pods stack too high and reach the top

## 📈 Node Status Indicators

- 🟢 **Green**: Healthy (< 60% resource usage)
- 🟡 **Yellow**: Moderate load (60-80% usage)
- 🔴 **Red**: High load (> 80% usage)

## 💡 Tips for Success

1. **Monitor Node Status**: Keep an eye on resource usage
2. **Plan Ahead**: Consider the next pod's requirements
3. **Distribute Load**: Don't overload single nodes
4. **Use Dependencies**: Place related services together
5. **Clear Lines**: Stack pods efficiently to trigger line clears

## 🏆 High Scores

- Scores are saved locally in your browser
- Top 10 scores are displayed
- Enter your name for new high scores
- Compete with friends on the same device

---

**Ready to become a Kubernetes orchestration master?** 
Start the game and begin placing pods! 🚀
