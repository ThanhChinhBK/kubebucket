# Kube Tetris - Game Instructions

## 🎯 Objective
Manage Kubernetes pods by placing them optimally on nodes while respecting resource constraints and maintaining cluster health.

## 🎮 How to Play

### Basic Mechanics
- **Mixed Drops**: Pods and resource upgrades fall from the top
- **Drop Ratio**: ~5 pods for every 1 resource upgrade
- **5 Nodes**: Bottom row contains 5 nodes acting as resource buckets
- **Dynamic Resources**: Each node has upgradeable CPU, RAM, SSD, and GPU capacity
- **Pod Placement**: Pods stack vertically above nodes
- **Resource Upgrades**: Apply resource upgrades to increase node capacity

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
- **SSD**: Available/Total storage (GB)
- **GPU**: Available/Total GPU units (if any)
- **Node ID**: N0, N1, N2, N3, N4
- **Status Bar**: Visual resource usage indicator

### Pod Resources
Each pod shows **randomized resource requirements**:
- **Type**: Service type (Frontend, Backend, Database, etc.)
- **CPU**: Required CPU cores (varies by type)
- **RAM**: Required memory in GB (varies by type)
- **SSD**: Required storage in GB (varies by type)
- **GPU**: Required GPU units (ML tasks only)
- **Symbol**: Letter identifier
- **Color**: Type-specific color coding

### Resource Upgrades
Resource upgrade items appear with **randomized capacity values**:
- Drop ratio: ~1 in 5 drops is a resource upgrade
- Each upgrade shows its exact capacity increase
- Apply upgrades to nodes by placing them on the node
- Upgrades increase the total capacity of that resource type

## 🚀 Drop Types

### Pods (Services)
| Type | Symbol | Description | Resource Range |
|------|--------|-------------|----------------|
| **F** | Frontend | Web UI components | CPU: 0.5-1, RAM: 2-4GB, SSD: 5-10GB |
| **B** | Backend | API services | CPU: 1-4, RAM: 1-12GB, SSD: 10-30GB |
| **D** | Database | Data storage | CPU: 2-6, RAM: 8-24GB, SSD: 20-60GB |
| **C** | Cache | Memory cache | CPU: 0.5-2, RAM: 8-32GB, SSD: 2-10GB |
| **M** | Monitor | Observability | CPU: 0.5-1, RAM: 1-4GB, SSD: 5-10GB |
| **ML** | ML Task | Machine Learning | CPU: 2-8, RAM: 8-32GB, SSD: 20-80GB, GPU: 1-4 |

### Resources (Upgrades)
Resource upgrades have **randomized capacity values**:

| Type | Symbol | Description | Capacity Range |
|------|--------|-------------|----------------|
| **R** | RAM | Memory upgrade | +2GB, +4GB, or +8GB |
| **CP** | CPU | Processing upgrade | +2, +4, or +8 cores |
| **G** | GPU | Graphics upgrade | +1, +2, or +4 GPU units |
| **S** | SSD | Storage upgrade | +20GB, +40GB, or +80GB |

*Note: Each resource upgrade shows its exact capacity value when it drops*

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

1. **Monitor Node Status**: Keep an eye on resource usage across all resource types
2. **Plan Ahead**: Consider the next drop's requirements
3. **Distribute Load**: Don't overload single nodes with too many pods
4. **Use Resource Upgrades**: Apply upgrades strategically to increase node capacity
5. **Balance Resources**: Some pods need GPU, others need more RAM or CPU
6. **Clear Lines**: Stack pods efficiently to trigger line clears
7. **Resource Strategy**: Save high-capacity resource upgrades for busy nodes

## 🏆 High Scores

- Scores are saved locally in your browser
- Top 10 scores are displayed
- Enter your name for new high scores
- Compete with friends on the same device

---

**Ready to become a Kubernetes orchestration master?** 
Start the game and begin placing pods! 🚀
