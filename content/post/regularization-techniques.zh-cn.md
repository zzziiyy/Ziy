---
title: "神经网络中的正则化：每种方法究竟做了什么"
date: 2025-01-28
author: "ZZ"
description: "L1、L2、Dropout、批归一化、早停——对每种正则化技术机理的清醒梳理。"
tags: ["深度学习", "正则化", "神经网络", "训练"]
draft: false
---

正则化是任何减少过拟合的技术——过拟合是指模型对训练数据学得太好、但无法泛化的问题。以下是主要方法的梳理，以及它们在机制上实际做了什么。

## L2 正则化（权重衰减）

在损失函数中加入对大权重的惩罚项：

$$\mathcal{L}_{\text{reg}} = \mathcal{L} + \frac{\lambda}{2} \|\theta\|^2$$

惩罚项的梯度为 $\lambda \theta$，因此更新规则变为：

$$\theta \leftarrow \theta - \eta(\nabla \mathcal{L} + \lambda \theta) = (1 - \eta\lambda)\theta - \eta\nabla\mathcal{L}$$

$(1 - \eta\lambda)$ 这一项在每一步都会*缩小*权重——因此称为"权重衰减"。大权重受到更多惩罚，推动模型向没有单一参数主导的解靠拢。

**几何直觉**：L2 正则化将权重约束在原点附近的球内。解在拟合数据与保持靠近零之间进行权衡。

## L1 正则化（Lasso）

对绝对值之和的惩罚：

$$\mathcal{L}_{\text{reg}} = \mathcal{L} + \lambda \|\theta\|_1$$

$|\theta|$ 的梯度是 $\text{sign}(\theta)$——幅度与权重大小无关。这会产生**稀疏解**：权重被推向精确的零，实际上起到了特征选择的效果。在需要特征选择时很有用。

在实践中，L1 在深度学习中比 L2 少见，因为在零点的不可微性对基于梯度的优化造成问题（尽管次梯度可以处理）。

## Dropout

在训练时，以概率 $p$（通常 0.1–0.5）随机将每个神经元的激活置零：

```python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(128, 10),
        )
```

在推理时，Dropout 被禁用，激活值按 $(1 - p)$ 缩放，以补偿训练期间活跃神经元的预期比例。

**为什么有效**：有几种互补的解释——
- 强迫网络学习冗余表示（没有神经元可以依赖其他神经元始终存在）
- 有效地训练了 $2^n$ 个共享权重的子网络集成
- 作为一种噪声注入，平滑了损失曲面

## 批归一化

在每个小批量内对激活值进行归一化，然后应用学习到的缩放和偏移：

$$\hat{x}_i = \frac{x_i - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y_i = \gamma \hat{x}_i + \beta$$

其中 $\mu_B$ 和 $\sigma_B^2$ 是批均值和批方差，$\gamma$、$\beta$ 是学习参数。

**为何起正则化作用**：归一化依赖于批次，引入了类似正则化效果的噪声。此外，它减少了内部协变量偏移（随着权重更新，各层分布发生变化），从而允许更高的学习率，使训练更加稳定。

BN 应用于线性层/卷积层和激活函数之间。在推理时，批统计量被训练期间累积的运行统计量所替代。

## 早停

在训练过程中监控验证损失，当其开始上升时停止：

```python
best_val_loss = float('inf')
patience = 10
epochs_without_improvement = 0

for epoch in range(max_epochs):
    train(model, train_loader)
    val_loss = evaluate(model, val_loader)
    
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        save_checkpoint(model)
        epochs_without_improvement = 0
    else:
        epochs_without_improvement += 1
    
    if epochs_without_improvement >= patience:
        load_checkpoint(model)
        break
```

简单有效。隐式正则化来自于将模型保持在训练早期到达的参数空间区域，在它开始记忆噪声之前。

## 数据增强

通过施加保持标签不变的变换来扩充有效训练集：翻转、裁剪、旋转、颜色抖动（图像），同义词替换、回译（文本）。迫使模型学习不变性，而非记忆具体输入。

在无法获得更多数据时，这通常是最有效的正则化形式。

## 实践建议

这些方法并不互斥——大多数现代网络同时使用几种：

- BN 在 CNN 中几乎无处不在
- Dropout 在全连接层和 Transformer 注意力头中是标配
- 权重衰减（AdamW）是微调的默认选择
- 数据增强在领域允许时始终适用
- 早停始终保留，作为安全网

正则化的合适量取决于数据集大小和模型容量。数据越多 → 需要的正则化越少；模型越大 → 需要的正则化越多。
