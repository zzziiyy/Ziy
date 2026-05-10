---
title: "Attention Mechanisms: The Actual Math"
date: 2025-04-10
author: "ZZ"
description: "Working through scaled dot-product attention from first principles — what it computes, why it works, and where people usually get confused."
tags: ["deep learning", "transformers", "attention", "NLP"]
draft: false
---

Attention is one of those concepts that's easy to nod along to and harder to feel like you actually understand. This is my attempt to work through it carefully enough that the pieces connect.

## The setup

You have a sequence of vectors. Call them the **values** — the things you want to retrieve. You also have a **query** — what you're looking for — and a set of **keys** that describe what each value "contains."

The goal: produce a weighted combination of the values, where the weights are determined by how well the query matches each key.

That's it. Everything else is implementation detail.

## Scaled dot-product attention

The standard formulation:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

Where:
- $Q \in \mathbb{R}^{n \times d_k}$ — queries
- $K \in \mathbb{R}^{m \times d_k}$ — keys  
- $V \in \mathbb{R}^{m \times d_v}$ — values
- $d_k$ — dimension of the key/query vectors

Walking through it:

1. **$QK^T$** — compute a similarity score between every query and every key. Shape: $(n \times m)$. Each entry $(i, j)$ is the dot product of query $i$ with key $j$.

2. **Divide by $\sqrt{d_k}$** — scale to prevent the dot products from getting large when $d_k$ is large. Large dot products push softmax into near-zero gradient regions. This scaling keeps things trainable.

3. **softmax(...)** — normalize the scores into weights that sum to 1 along the key dimension. Now each row is a probability distribution over the $m$ keys.

4. **Multiply by $V$** — compute a weighted sum of the values. The output is a blend of values, weighted by how relevant each key was to the query.

## Why dot product for similarity?

You could use other similarity measures — L2 distance, cosine similarity, a learned MLP. Dot product is used because:
- It's fast (matrix multiplication, hardware-optimized)
- It's differentiable everywhere
- With normalized vectors, it approximates cosine similarity

## The "self" in self-attention

In self-attention, the queries, keys, and values all come from the **same sequence**. Each position attends to every other position (including itself) to build a context-aware representation.

Concretely: given input $X \in \mathbb{R}^{n \times d}$, we compute:

$$Q = XW^Q, \quad K = XW^K, \quad V = XW^V$$

where $W^Q, W^K, W^V$ are learned projection matrices. The model learns what to look for (queries), what to expose (keys), and what to pass along (values).

## Multi-head attention

Instead of one attention computation, run $h$ of them in parallel with different learned projections, then concatenate:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, ..., \text{head}_h)W^O$$

$$\text{head}_i = \text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$$

Each head can learn to attend to different types of relationships — one might capture syntactic dependencies, another semantic similarity. The concatenation and final projection $W^O$ mixes them back together.

## Complexity

Self-attention over a sequence of length $n$ costs $O(n^2 d)$ — every position attends to every other. This is the bottleneck for long sequences and why efficient attention variants (sparse, linear, flash) are an active research area.

## Common confusions

**"Attention weights tell you what the model focuses on"** — sort of. They tell you what's being mixed, but interpreting them as "the model is looking at token $j$ when processing token $i$" is an oversimplification. The model might encode information in ways that don't correspond neatly to high attention weights.

**Keys vs queries** — in self-attention they're computed from the same input but via *different* weight matrices. They serve different roles: keys expose information, queries specify what to look for.

**Position encoding** — attention is permutation-equivariant. It doesn't know the order of the sequence unless you add positional information explicitly. That's what sinusoidal or learned position embeddings do.
