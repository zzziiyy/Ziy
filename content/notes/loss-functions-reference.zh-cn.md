---
title: "损失函数：何时用什么"
date: 2025-02-14
author: "ZZ"
description: "监督学习中常见损失函数的参考——回归、分类，以及标准选择不适用的情况。"
tags: ["机器学习", "损失函数", "参考", "训练"]
draft: false
---

## 回归

### MSE（均方误差）

$$\mathcal{L} = \frac{1}{n}\sum_i (y_i - \hat{y}_i)^2$$

默认选择。对大误差施加重罚（二次惩罚）。处处可微。对异常值敏感，因为平方会放大它们。

### MAE（平均绝对误差）

$$\mathcal{L} = \frac{1}{n}\sum_i |y_i - \hat{y}_i|$$

对异常值鲁棒。梯度为常数（$\pm 1$），在极小值附近可能导致不稳定。当数据中存在你不想过拟合的真实异常值时更好。

### Huber 损失

$$\mathcal{L}_\delta = \begin{cases} \frac{1}{2}(y - \hat{y})^2 & \text{若 } |y - \hat{y}| \leq \delta \\ \delta |y - \hat{y}| - \frac{1}{2}\delta^2 & \text{否则} \end{cases}$$

在零附近表现为 MSE，对大误差表现为 MAE。兼得两者之长：靠近时梯度平滑，偏离时鲁棒。$\delta$ 是控制过渡的超参数。

### 何时 MSE 不适用

如果目标分布有重尾或频繁的异常值，MSE 会训练模型去"追逐"异常值（高惩罚 = 大梯度）。此时 MAE 或 Huber 损失通常更好。

---

## 二分类

### 二元交叉熵

$$\mathcal{L} = -\frac{1}{n}\sum_i \left[ y_i \log \hat{p}_i + (1-y_i)\log(1-\hat{p}_i) \right]$$

标准选择。与 sigmoid 输出自然配对。对自信地预测错误的情况施以重罚（概率趋近 0 时 log 趋向 $-\infty$）。

### Focal 损失

$$\mathcal{L}_{\text{focal}} = -\alpha (1 - \hat{p})^\gamma \log \hat{p}$$

针对类别不平衡问题。对简单样本降权（当模型自信且正确时，$(1 - \hat{p})^\gamma \to 0$），使训练聚焦于难样本。常用于目标检测。

---

## 多分类

### 类别交叉熵（Softmax 损失）

$$\mathcal{L} = -\sum_i y_i \log \hat{p}_i$$

多分类的标准选择。独热编码的 $y$，softmax 输出的 $\hat{p}$。最小化等价于在类别分布下最大化对数似然。

### 标签平滑

将独热目标替换为软目标：真实类别为 $(1 - \epsilon)$，其余类别各为 $\epsilon / (K-1)$。防止过于自信的预测。在图像分类中常用，有助于泛化。

```python
# PyTorch
criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
```

---

## 排序 / 度量学习

### 对比损失

将相似对拉近，将不相似对推远：

$$\mathcal{L} = y \cdot d^2 + (1-y) \cdot \max(0, m - d)^2$$

其中 $d$ 是嵌入之间的距离，$m$ 是间隔。

### 三元组损失

给定一个锚点、一个正样本（同类）和一个负样本（不同类）：

$$\mathcal{L} = \max(0, d(a, p) - d(a, n) + \text{margin})$$

直接优化相对距离。需要精心的三元组挖掘——随机三元组大多是简单样本，无法提供有效梯度。

---

## 快速决策指南

| 问题 | 默认损失 |
|------|---------|
| 回归，数据干净 | MSE |
| 回归，存在异常值 | Huber |
| 二分类 | 二元交叉熵 |
| 多分类 | 交叉熵 |
| 类别不平衡 | Focal 损失 |
| 嵌入学习 | 三元组 / 对比损失 |
| 序列生成 | 交叉熵（词元级别） |
