---
title: "Comparing Optimizers on a Simple Benchmark"
date: 2025-02-28
author: "ZZ"
description: "SGD, Momentum, RMSProp, and Adam on a small classification task — convergence speed, final accuracy, and sensitivity to learning rate."
tags: ["optimization", "experiment", "pytorch", "training"]
draft: false
---

**Status:** Done. Confirms expected behavior; Adam wins on speed, SGD occasionally on final accuracy.

## Setup

Dataset: CIFAR-10 subset (10k training, 2k validation).  
Model: Small CNN (2 conv layers + 2 FC layers, ~200k parameters).  
Fixed: batch size 128, 30 epochs, same random seed.  
Varied: optimizer and learning rate.

## Results

### Convergence speed (val accuracy at epoch 10)

| Optimizer | lr=0.1 | lr=0.01 | lr=0.001 |
|-----------|--------|---------|---------|
| SGD | 41% | 52% | 38% |
| SGD + Momentum | 55% | 61% | 44% |
| RMSProp | 48% | 57% | 59% |
| Adam | 52% | **65%** | 63% |

Adam at lr=0.01 is the best at epoch 10. SGD at lr=0.1 is surprisingly bad — it oscillates early.

### Final accuracy (epoch 30)

| Optimizer | Best lr | Val accuracy |
|-----------|---------|-------------|
| SGD | 0.01 | 67% |
| SGD + Momentum | 0.01 | **70%** |
| RMSProp | 0.001 | 68% |
| Adam | 0.01 | 69% |

SGD with momentum edges out Adam at convergence — consistent with reported results in vision tasks.

### Sensitivity to learning rate

Adam is noticeably less sensitive to learning rate choice. SGD at lr=0.1 diverges early; Adam at lr=0.1 just converges slightly slower. This matches the intuition: adaptive methods are more forgiving.

## Loss curves

SGD with momentum shows the most "momentum-like" behavior — smooth, consistent descent with occasional small plateaus. Adam occasionally jumps, suggesting it's escaping local minima more aggressively.

## Caveats

This is a small experiment on a small dataset. The "SGD generalization advantage" is a real phenomenon but shows up more reliably on larger models and datasets trained longer. 30 epochs on CIFAR-10 subset is not that.

Also: I didn't tune learning rate schedules, which would change results significantly (cosine annealing + SGD is a common production choice).

## Takeaway

For fast iteration and prototyping: Adam at lr=1e-3 is a solid default — it works without much tuning. For final training runs on vision tasks where you want maximum accuracy: SGD + momentum with a scheduler is often worth the tuning cost.
