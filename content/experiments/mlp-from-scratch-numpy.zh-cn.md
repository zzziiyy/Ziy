---
title: "用 NumPy 从零训练 MLP"
date: 2025-04-15
author: "ZZ"
description: "构建一个包含前向传播、反向传播和训练循环的两层神经网络——不用 PyTorch，不用 autograd。"
tags: ["神经网络", "numpy", "从零开始", "实验"]
draft: false
---

**状态：** 已完成。在 XOR 和 MNIST 子集上可以运行。

## 为什么要这样做

框架隐藏了机制。手写一次反向传播是值得的——之后你会明白 autograd 在做什么，梯度调试也不再像猜谜了。

## 网络结构

两层 MLP：输入 → 隐藏层（ReLU）→ 输出层（softmax）→ 交叉熵损失。

```python
import numpy as np

class MLP:
    def __init__(self, input_dim, hidden_dim, output_dim, lr=0.01):
        # He 初始化，适用于 ReLU
        self.W1 = np.random.randn(input_dim, hidden_dim) * np.sqrt(2 / input_dim)
        self.b1 = np.zeros((1, hidden_dim))
        self.W2 = np.random.randn(hidden_dim, output_dim) * np.sqrt(2 / hidden_dim)
        self.b2 = np.zeros((1, output_dim))
        self.lr = lr

    def relu(self, x):
        return np.maximum(0, x)

    def softmax(self, x):
        e = np.exp(x - x.max(axis=1, keepdims=True))  # 数值稳定性
        return e / e.sum(axis=1, keepdims=True)

    def forward(self, X):
        self.X = X
        self.z1 = X @ self.W1 + self.b1
        self.h = self.relu(self.z1)
        self.z2 = self.h @ self.W2 + self.b2
        self.probs = self.softmax(self.z2)
        return self.probs

    def loss(self, probs, y):
        n = y.shape[0]
        log_probs = -np.log(probs[np.arange(n), y] + 1e-9)
        return log_probs.mean()

    def backward(self, y):
        n = y.shape[0]

        # 输出层梯度
        dz2 = self.probs.copy()
        dz2[np.arange(n), y] -= 1
        dz2 /= n

        dW2 = self.h.T @ dz2
        db2 = dz2.sum(axis=0, keepdims=True)

        # 隐藏层梯度
        dh = dz2 @ self.W2.T
        dz1 = dh * (self.z1 > 0)  # ReLU 导数

        dW1 = self.X.T @ dz1
        db1 = dz1.sum(axis=0, keepdims=True)

        # 参数更新
        self.W2 -= self.lr * dW2
        self.b2 -= self.lr * db2
        self.W1 -= self.lr * dW1
        self.b1 -= self.lr * db1

    def train_step(self, X, y):
        probs = self.forward(X)
        l = self.loss(probs, y)
        self.backward(y)
        return l
```

## 训练循环

```python
model = MLP(input_dim=784, hidden_dim=128, output_dim=10, lr=0.1)

for epoch in range(50):
    # 小批量 SGD
    indices = np.random.permutation(len(X_train))
    total_loss = 0
    for i in range(0, len(X_train), 64):
        batch = indices[i:i+64]
        loss = model.train_step(X_train[batch], y_train[batch])
        total_loss += loss
    
    if epoch % 10 == 0:
        preds = model.forward(X_val).argmax(axis=1)
        acc = (preds == y_val).mean()
        print(f"Epoch {epoch}: loss={total_loss:.3f}, val_acc={acc:.3f}")
```

## MNIST 上的结果（1000 个训练样本）

| 隐藏层维度 | 轮次 | 验证准确率 |
|-----------|------|------------|
| 64 | 50 | 87.2% |
| 128 | 50 | 89.4% |
| 256 | 50 | 90.1% |

对于纯 NumPy 实现、不加数据增强或正则化来说，结果还不错。

## 验证了什么

- **梯度检验**：在小型网络上，数值梯度与解析梯度精确到小数点后 5 位——反向传播是正确的
- **损失下降**：在正确的学习率下，训练损失持续下降
- **过拟合测试**：小型网络在 100 个样本上达到约 100% 的训练准确率（符合预期）

## 经验教训

softmax 的数值稳定性问题（`x - x.max()`）容易让人栽跟头。没有这一步，`np.exp` 对大的 logit 值会溢出。加上这个常数不会改变数学输出，但能把数值保持在合理范围内。

ReLU 的梯度（`z1 > 0`）只是一个二元掩码——预激活为负的位置为零，为正的位置为一。原理简单，但如果存储了错误的中间变量就容易出错。
