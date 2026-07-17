---
title: "模型评估指标参考"
date: 2025-01-08
author: "ZZ"
description: "分类与回归指标——它们衡量什么、何时会产生误导，以及如何计算。"
tags: ["机器学习", "评估", "指标", "参考"]
draft: false
---

## 分类指标

### 准确率（Accuracy）

$$\text{Accuracy} = \frac{TP + TN}{TP + TN + FP + FN}$$

直观，但在不平衡数据集上会产生误导。如果 95% 的样本属于类别 0，那么一个始终预测 0 的模型准确率为 95%——但它毫无用处。

### 精确率与召回率

$$\text{Precision} = \frac{TP}{TP + FP}, \quad \text{Recall} = \frac{TP}{TP + FN}$$

- **精确率**：在你预测为正类的样本中，有多少实际上是正类？
- **召回率**：在所有实际的正类中，你捕捉到了多少？

两者相互权衡。降低决策阈值会提高召回率（捕捉更多正类），但降低精确率（更多误报）。

### F1 分数

$$F_1 = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$

精确率与召回率的调和平均。在同等重视两者时使用。当假负类代价更高时，$F_\beta$ 将召回率的权重提升 $\beta$ 倍。

### ROC-AUC

受试者工作特征曲线下面积。衡量随机选取的正样本排名高于随机选取的负样本的概率。与阈值无关。范围：0.5（随机）到 1.0（完美）。

**AUC 产生误导的情况**：在高度不平衡的数据集上，即使模型很差也可能获得高 AUC，因为真负类占主导。此时建议使用精确率-召回率 AUC。

### 马修斯相关系数（MCC）

$$\text{MCC} = \frac{TP \cdot TN - FP \cdot FN}{\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}$$

范围：-1 到 +1。在不平衡数据集上表现良好。常被低估——比准确率或 F1 更难解读，但在许多场景下更具信息量。

---

## 回归指标

### RMSE

$$\text{RMSE} = \sqrt{\frac{1}{n}\sum_i(y_i - \hat{y}_i)^2}$$

与 $y$ 的单位相同。比 MAE 更重视大误差。最常用。

### MAE

$$\text{MAE} = \frac{1}{n}\sum_i |y_i - \hat{y}_i|$$

比 RMSE 更易解读（"平均预测误差为 X 个单位"）。对异常值不那么敏感。

### R²（决定系数）

$$R^2 = 1 - \frac{\sum_i(y_i - \hat{y}_i)^2}{\sum_i(y_i - \bar{y})^2}$$

解释的方差比例。范围：$(-\infty, 1]$。R² = 1 是完美的；R² = 0 意味着模型不比预测均值好；R² < 0 意味着模型比预测均值还差。

**陷阱**：即使模型存在偏差，R² 也可能很高。一定要绘制预测值与真实值的对比图。

---

## 交叉验证

对于小数据集，单次训练/测试划分会产生嘈杂的估计。K 折交叉验证对 $k$ 次划分取平均：

```python
from sklearn.model_selection import cross_val_score
scores = cross_val_score(model, X, y, cv=5, scoring='r2')
print(f"R² = {scores.mean():.3f} ± {scores.std():.3f}")
```

对于分类任务，使用分层 K 折以保持每折中的类别比例。

---

## 校准问题

高准确率/AUC 不代表概率估计良好。一个预测 0.9 概率的模型，应该在 90% 的情况下是对的——如果实际上只有 60% 的时候是对的，那它就过于自信了。

用可靠性图检验校准情况。通过温度缩放或 Platt 缩放作为后处理步骤来修正。
