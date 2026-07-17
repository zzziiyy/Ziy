---
title: "可视化各分类器的决策边界"
date: 2024-12-18
author: "ZZ"
description: "在二维玩具数据集上绘制不同分类器实际学到的内容——一个建立直觉的可视化练习。"
tags: ["分类", "可视化", "sklearn", "实验"]
draft: false
---

**状态：** 已完成。对于建立直觉有参考价值；读过 PRML 的人可能觉得显而易见，但有这份记录还是值得的。

## 动机

人们很容易把分类器当作输出标签的黑箱来对待。在玩具数据上绘制决策边界，能让你看到模型实际学到了什么——边界在哪里、有多平滑，以及它们如何应对异常点。

## 实验设置

六个分类器，三个二维数据集（月牙形、圆环形、带噪声的线性可分数据）：

```python
from sklearn.datasets import make_moons, make_circles, make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
import numpy as np
import matplotlib.pyplot as plt

def plot_decision_boundary(model, X, y, ax, title):
    h = 0.02
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
    xx, yy = np.meshgrid(np.arange(x_min, x_max, h),
                          np.arange(y_min, y_max, h))
    
    Z = model.predict(np.c_[xx.ravel(), yy.ravel()])
    Z = Z.reshape(xx.shape)
    
    ax.contourf(xx, yy, Z, alpha=0.4)
    ax.scatter(X[:, 0], X[:, 1], c=y, edgecolors='k', s=20)
    ax.set_title(title)
```

## 观察结果

**逻辑回归**：完全线性的边界。对月牙形和圆环形数据效果很差——数据本身线性不可分，LR 对此无能为力。

**SVM（RBF 核）**：平滑的曲线边界。对月牙形和圆环形都处理得很好。受 `C`（间隔硬度）和 `gamma`（核带宽）控制。对尺度敏感——对输入归一化的影响很大。

**决策树**：锐利的轴对齐边界。不加剪枝时严重过拟合——你可以看到边界为了拟合每个单独的点而锯齿化。设置 `max_depth=3` 后，边界干净，但会错过一些细节。

**随机森林**：比单棵树平滑，比 SVM 更灵活。对三个数据集都处理得很好。近看边界有些"块状"，但泛化效果好。

**梯度提升**：与随机森林类似，但边界通常更清晰。对超参数更敏感。

**KNN**：非常灵活的非参数边界。当 $k$ 很小（k=1）时，训练准确率完美但边界参差不齐，存在过拟合。$k=15$ 时，边界平滑且合理。对训练分布之外的测试数据表现差。

## 核心视觉教训

过拟合看起来像是一条扭曲自身以拟合每个训练点的锯齿边界。欠拟合看起来像是一条无法捕捉数据真实形状的边界。目标是找到足够平滑以泛化、又足够有表达力以捕捉真实模式的边界。

这些道理写出来很显而易见。但在同一批数据集上，跨六个分类器直观地看到它，才真正让它印在脑子里。

## 代码说明

网格法在高维数据上代价高昂——只有在使用恰好 2 个特征时才适合可视化。更高维度的情况需要先进行降维（PCA、t-SNE）。
