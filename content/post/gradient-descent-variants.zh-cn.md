---
title: "梯度下降的几种变体：SGD、Momentum 与 Adam"
date: 2025-03-05
author: "ZZ"
description: "梯度下降变体的实用比较——每种方法解决什么问题，以及何时该用哪个。"
tags: ["优化", "深度学习", "训练", "python"]
draft: false
---

优化算法是那种理论很清晰、实践却很混乱的领域。以下是对主要变体的梳理，以及它们实际在做什么。

## 原始梯度下降

基本更新规则：

$$\theta \leftarrow \theta - \eta \nabla_\theta \mathcal{L}(\theta)$$

计算损失关于所有参数的梯度，乘以学习率 $\eta$，再减去。简单直接。

**问题所在：**
- **全批量 GD**：梯度基于整个数据集计算——对大型数据集来说速度慢、内存消耗大
- **SGD**（随机）：梯度来自单个样本——速度快但噪声极大，损失值上下跳动
- **小批量 SGD**：折中方案——基于小批量样本计算梯度（通常 32–512 个样本）

在实践中，"SGD"通常指小批量 SGD。

## SGD 无法解决的问题：山谷地形

想象一个形如狭窄山谷的损失曲面。梯度下降在狭窄维度上来回震荡，同时沿山谷底部缓慢推进。垂直于最速下降方向的梯度分量相互抵消效果很差。

## 动量（Momentum）

添加一个累积梯度的速度项：

$$v_t = \beta v_{t-1} + (1 - \beta) \nabla_\theta \mathcal{L}$$
$$\theta \leftarrow \theta - \eta v_t$$

$\beta$ 通常取 0.9。速度项对近期梯度进行平均——方向一致的分量累积，来回震荡的分量相互抵消。这减弱了山谷问题，并加快了在平滑方向上的推进速度。

**Nesterov 动量**在"超前"位置 $\theta - \beta v_{t-1}$ 而非当前位置处计算梯度，实践中收敛略好。

## AdaGrad

根据历史梯度幅度，为每个参数自适应学习率：

$$G_t = G_{t-1} + g_t^2$$
$$\theta \leftarrow \theta - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

接受大梯度的参数学习率更小；很少更新的参数学习率更大。对稀疏特征（如大多数词语很少出现的词嵌入）很有用。

**问题**：$G_t$ 只增不减，学习率单调递减，最终变得极小。

## RMSProp

用指数移动平均解决 AdaGrad 的学习率收缩问题：

$$G_t = \gamma G_{t-1} + (1 - \gamma) g_t^2$$
$$\theta \leftarrow \theta - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

窗口大小由 $\gamma$（通常取 0.99）控制。旧梯度会衰减，因此分母反映的是近期曲率，而非累积历史。

## Adam

结合动量（一阶矩）与 RMSProp（二阶矩）：

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t \quad \text{（均值）}$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2 \quad \text{（方差）}$$

偏差修正（两个矩初始化为零，在训练早期存在偏向零的偏差）：

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

更新：

$$\theta \leftarrow \theta - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

默认超参数（$\beta_1 = 0.9$，$\beta_2 = 0.999$，$\epsilon = 10^{-8}$）在各类问题上表现良好。这也是 Adam 成为大多数深度学习工作默认优化器的原因。

## 简单实现对比

```python
import torch.optim as optim

# 带动量的 SGD
optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9)

# Adam
optimizer = optim.Adam(model.parameters(), lr=1e-3)

# AdamW（解耦权重衰减的 Adam——通常比 Adam 更好）
optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
```

## 何时用哪个

| 优化器 | 适用场景 |
|--------|----------|
| SGD + 动量 | 需要精细控制时；视觉任务的 CNN |
| Adam | 大多数任务的默认选择，尤其是 NLP |
| AdamW | 预训练模型的微调 |
| RMSProp | RNN、强化学习 |

## 泛化差距

有一个已知现象：Adam 收敛更快，但 SGD 加上精心调整的学习率调度有时能达到更好的最终测试准确率。直觉上：Adam 对局部曲率进行自适应，可能导致其收敛到泛化较差的尖锐极小值；SGD 加动量则倾向于更平坦的极小值。

这并不是一个普遍规律——依赖于具体问题——但这也是一些从业者在训练后期切换回 SGD 或大量使用调度策略的原因。
