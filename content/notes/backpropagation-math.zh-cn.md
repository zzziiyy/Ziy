---
title: "反向传播：逐步推导链式法则"
date: 2025-03-20
author: "ZZ"
description: "针对小型网络的反向传播逐步推导——没有含糊其辞。"
tags: ["神经网络", "反向传播", "数学", "参考"]
draft: false
---

反向传播不过是将链式法则系统地应用于计算图。以下是针对两层网络的清晰推导。

## 设定

两层网络，单输出，MSE 损失：

- 输入：$x \in \mathbb{R}^n$
- 第 1 层：$h = \sigma(W_1 x + b_1)$，其中 $W_1 \in \mathbb{R}^{m \times n}$
- 第 2 层：$\hat{y} = W_2 h + b_2$，其中 $W_2 \in \mathbb{R}^{1 \times m}$
- 损失：$\mathcal{L} = \frac{1}{2}(\hat{y} - y)^2$

我们要求 $\frac{\partial \mathcal{L}}{\partial W_1}$、$\frac{\partial \mathcal{L}}{\partial W_2}$ 等。

## 前向传播（定义中间量）

$$z_1 = W_1 x + b_1$$
$$h = \sigma(z_1)$$
$$z_2 = W_2 h + b_2$$
$$\hat{y} = z_2$$
$$\mathcal{L} = \frac{1}{2}(\hat{y} - y)^2$$

## 反向传播

从损失出发，向后推导。

**$\frac{\partial \mathcal{L}}{\partial \hat{y}}$：**

$$\frac{\partial \mathcal{L}}{\partial \hat{y}} = \hat{y} - y$$

**$\frac{\partial \mathcal{L}}{\partial W_2}$**（通过 $z_2 = W_2 h + b_2$ 的链式法则）：

$$\frac{\partial \mathcal{L}}{\partial W_2} = \frac{\partial \mathcal{L}}{\partial \hat{y}} \cdot h^T = (\hat{y} - y) h^T$$

**$\frac{\partial \mathcal{L}}{\partial h}$：**

$$\frac{\partial \mathcal{L}}{\partial h} = W_2^T \cdot \frac{\partial \mathcal{L}}{\partial \hat{y}} = W_2^T (\hat{y} - y)$$

**$\frac{\partial \mathcal{L}}{\partial z_1}$**（逐元素，通过 $\sigma$）：

$$\frac{\partial \mathcal{L}}{\partial z_1} = \frac{\partial \mathcal{L}}{\partial h} \odot \sigma'(z_1)$$

**$\frac{\partial \mathcal{L}}{\partial W_1}$：**

$$\frac{\partial \mathcal{L}}{\partial W_1} = \frac{\partial \mathcal{L}}{\partial z_1} \cdot x^T$$

## 规律

每一层的梯度遵循相同的结构：
1. 接收来自上一层的梯度
2. 与局部雅可比矩阵相乘（本层输出关于输入的导数）
3. 将结果传递给下一层

这也是它被称为*反*向传播的原因——梯度在计算图中反向流动。

## 梯度消失

若 $\sigma = \tanh$，则 $\sigma'(z) \in (0, 1]$。在深层网络中，梯度在每一层都会乘以 $\sigma'$。层数多了，这个乘积趋近于零——梯度消失，早期层学习极慢。

ReLU（$\sigma'(z) = 1$，当 $z > 0$ 时）对活跃神经元避免了这个问题。ResNet 中的残差连接（跳跃连接）提供了绕过乘法链的梯度高速通道。

## 数值梯度检验

验证实现时总是有用的：

```python
def numerical_gradient(f, x, eps=1e-5):
    grad = np.zeros_like(x)
    for i in range(x.size):
        x_plus = x.copy(); x_plus.flat[i] += eps
        x_minus = x.copy(); x_minus.flat[i] -= eps
        grad.flat[i] = (f(x_plus) - f(x_minus)) / (2 * eps)
    return grad
```

与解析梯度对比。若它们精确到小数点后约 5 位，则反向传播是正确的。
