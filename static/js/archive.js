/* ============================================================
   THE LAST ARCHIVE / 最后的档案馆
   archive.js — interactive narrative engine
   Vanilla JS, no external dependencies, IIFE, 'use strict'
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     UTILITIES
  ────────────────────────────────────────────────────────── */

  var REDUCED_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function t(en, zh) {
    return state.lang === 'zh' ? zh : en;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') {
          node.className = attrs[k];
        } else if (k === 'htmlFor') {
          node.setAttribute('for', attrs[k]);
        } else if (k === 'style') {
          Object.keys(attrs[k]).forEach(function (p) {
            node.style[p] = attrs[k][p];
          });
        } else if (k.startsWith('data-')) {
          node.setAttribute(k, attrs[k]);
        } else {
          node[k] = attrs[k];
        }
      });
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null) return;
        if (typeof c === 'string' || typeof c === 'number') {
          node.appendChild(document.createTextNode(String(c)));
        } else {
          node.appendChild(c);
        }
      });
    }
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  /* ──────────────────────────────────────────────────────────
     STATE
  ────────────────────────────────────────────────────────── */

  // Normalize Hugo's ARCHIVE_LANG ('zh-cn', 'zh-tw', etc. → 'zh')
  function normalizeLang(raw) {
    return (raw && String(raw).toLowerCase().startsWith('zh')) ? 'zh' : 'en';
  }

  var state = {
    lang: normalizeLang(window.ARCHIVE_LANG),
    step: 'intro',          // 'intro' | 0..11 | 'processing' | 'result'
    answers: {},            // { [questionIndex]: value }
    rankingState: {},       // temp for drag ranking
    allocationState: {},    // temp for capacity sliders
    wordInput: '',
    result: null            // { archetypeId, costId, endingId, scores }
  };

  /* ──────────────────────────────────────────────────────────
     STORAGE
  ────────────────────────────────────────────────────────── */

  var STORAGE_KEY = 'arc-state';

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lang: state.lang,
        step: state.step,
        answers: state.answers,
        wordInput: state.wordInput,
        result: state.result
      }));
    } catch (e) { /* quota or private mode */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // Validate required keys exist
      if (
        parsed == null ||
        typeof parsed !== 'object' ||
        parsed.step === undefined ||
        parsed.answers === undefined ||
        parsed.lang === undefined ||
        parsed.wordInput === undefined
      ) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  /* ──────────────────────────────────────────────────────────
     QUESTIONS DATA
  ────────────────────────────────────────────────────────── */

  var QUESTIONS = [
    /* ── ACT I — ENTRY ────────────────────────────────────── */

    // Q0 — Object retrieval (choice)
    {
      id: 0, act: 1, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 01 / 12', zh: 'ARCHIVE SEQUENCE 01 / 12' },
      en: { text: 'The archive has room for one more uncatalogued item. Four objects have just arrived. Which do you retrieve first?' },
      zh: { text: '档案馆还有一件物品的空间。四件物品刚刚到达。你先取用哪一件？' },
      options: [
        {
          value: 'A',
          en: "A stranger's private diary, handwritten, untranslated",
          zh: '陌生人的私人日记，手写，未经翻译',
          scores: { privateMeaning: 2, authenticity: 1 }
        },
        {
          value: 'B',
          en: 'The final cartographic record of a demolished city',
          zh: '一座已被拆除城市的最后地图',
          scores: { preservation: 2, authenticity: 1 }
        },
        {
          value: 'C',
          en: 'Seed specimens from an extinct plant species',
          zh: '一种已灭绝植物的种子标本',
          scores: { preservation: 1, sacrifice: 1 }
        },
        {
          value: 'D',
          en: 'A recording in an unidentified voice, content unknown',
          zh: '一段无法辨认说话者身份的录音，内容未知',
          scores: { privateMeaning: 1, authenticity: 2 }
        }
      ]
    },

    // Q1 — Organization system (choice)
    {
      id: 1, act: 1, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 02 / 12', zh: 'ARCHIVE SEQUENCE 02 / 12' },
      en: { text: 'How do you organize the collection?' },
      zh: { text: '你如何整理这批藏品？' },
      options: [
        {
          value: 'A',
          en: 'By origin — who created it, who it belonged to',
          zh: '按来源——谁创造了它，它属于谁',
          scores: { privateMeaning: 2, control: 1 }
        },
        {
          value: 'B',
          en: 'By type — letter, map, image, object',
          zh: '按类型——信件、地图、图像、实物',
          scores: { control: 2, authenticity: 1 }
        },
        {
          value: 'C',
          en: 'By fragility — what is most at risk of being lost',
          zh: '按脆弱程度——什么最容易消失',
          scores: { preservation: 2 }
        },
        {
          value: 'D',
          en: 'No fixed system — let the collection find its own order',
          zh: '没有固定系统——让藏品自己形成秩序',
          scores: { control: -2, preservation: -1 }
        }
      ]
    },

    // Q2 — The claimant (choice)
    {
      id: 2, act: 1, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 03 / 12', zh: 'ARCHIVE SEQUENCE 03 / 12' },
      en: { text: 'A visitor arrives. An object in your archive, they say, belonged to their family. Its preservation without consent violates something private. But it is the only surviving record of an event that affected thousands of people.' },
      zh: { text: '一位访客来访。他们说，档案馆中的一件物品曾属于他们的家族。未经同意就保存它，侵犯了某些私密之物。但这是一场影响数千人的事件唯一留存的记录。' },
      options: [
        {
          value: 'A',
          en: "Return it. A family's right to their own history takes precedence.",
          zh: '归还它。家族对其自身历史的权利更重要。',
          scores: { privateMeaning: 2, control: 1, sacrifice: -1 }
        },
        {
          value: 'B',
          en: "Keep it sealed — accessible only with the family's consent.",
          zh: '保存但封存——只有经家族同意才可查阅。',
          scores: { authenticity: 1, control: 1 }
        },
        {
          value: 'C',
          en: 'Keep it accessible. History cannot be held privately.',
          zh: '保持可供查阅。历史不能被私人持有。',
          scores: { preservation: 2, privateMeaning: -2, control: 1 }
        },
        {
          value: 'D',
          en: 'Invite the family to annotate it — add their version alongside.',
          zh: '邀请家族为其做注解——在旁边加入他们的叙述。',
          scores: { privateMeaning: 1, authenticity: 1, sacrifice: 1 }
        }
      ]
    },

    /* ── ACT II — CONFLICT ─────────────────────────────────── */

    // Q3 — The evidence diary (choice)
    {
      id: 3, act: 2, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 04 / 12', zh: 'ARCHIVE SEQUENCE 04 / 12' },
      en: { text: "A diary contains evidence explaining the true cause of a disaster that killed many. On its final page, the author wrote: 'This must be destroyed when I am gone.' The author is gone." },
      zh: { text: "一本日记记录了一场曾夺走许多人生命的灾难的真实原因。在最后一页，作者写道：'我死后，必须销毁此物。'作者已经离开了。" },
      options: [
        {
          value: 'A',
          en: "Destroy it. The author's final instruction must be honoured.",
          zh: '销毁它。必须遵从作者的最后嘱托。',
          scores: { control: 1, sacrifice: -1, preservation: -2 }
        },
        {
          value: 'B',
          en: 'Preserve it sealed — to be opened in one hundred years.',
          zh: '封存保管——一百年后方可开启。',
          scores: { preservation: 2, control: 2, authenticity: 1 }
        },
        {
          value: 'C',
          en: 'Remove the personal passages, retain the historical evidence.',
          zh: '删除私人部分，保留历史证据。',
          scores: { authenticity: -1, preservation: 1, control: 2 }
        },
        {
          value: 'D',
          en: 'Leave the decision to a future keeper. This is beyond my authority.',
          zh: '将决定权留给未来的保管者。这超出了我的权限。',
          scores: { control: -2, sacrifice: -1 }
        }
      ]
    },

    // Q4 — Priority ranking (ranking)
    {
      id: 4, act: 2, type: 'ranking',
      label: { en: 'ARCHIVE SEQUENCE 05 / 12', zh: 'ARCHIVE SEQUENCE 05 / 12' },
      en: {
        text: 'The archive must be relocated urgently. You can only move items in sequence. Rank these four categories in order of preservation priority.',
        note: 'Drag to reorder, or use the arrow buttons.'
      },
      zh: {
        text: '档案馆必须紧急迁移。你只能按顺序转移物品。按保存优先级排列以下四个类别。',
        note: '拖动以重新排序，或使用箭头按钮。'
      },
      items: [
        { id: 'personal',   en: 'Personal correspondence — letters, notes, diaries',   zh: '私人通信——信件、笔记、日记' },
        { id: 'maps',       en: 'Maps and geographic records',                          zh: '地图与地理记录' },
        { id: 'biological', en: 'Biological specimens — seeds, preserved organisms',    zh: '生物标本——种子、保存的有机体' },
        { id: 'cultural',   en: 'Cultural objects — tools, clothing, objects of daily use', zh: '文化器物——工具、服装、日常用品' }
      ]
    },

    // Q5 — Allocation (capacity)
    {
      id: 5, act: 2, type: 'capacity',
      label: { en: 'ARCHIVE SEQUENCE 06 / 12', zh: 'ARCHIVE SEQUENCE 06 / 12' },
      en: { text: 'You have 100 units of archive capacity remaining. Allocate it however you choose. Unallocated units will be sealed and held in reserve.' },
      zh: { text: '你还有100个单位的档案空间。随意分配。未分配的单位将被封存备用。' },
      categories: [
        { id: 'personal',   en: 'Personal histories and testimonies',         zh: '个人历史与证词' },
        { id: 'scientific', en: 'Scientific records and technical knowledge',  zh: '科学记录与技术知识' },
        { id: 'art',        en: 'Art, music, and literature',                  zh: '艺术、音乐与文学' },
        { id: 'admin',      en: 'Administrative records — laws, agreements, statistics', zh: '行政记录——法律、协议、统计数据' }
      ]
    },

    /* ── ACT III — FRACTURE ────────────────────────────────── */

    // Q6 — Memory transfer (choice)
    {
      id: 6, act: 3, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 07 / 12', zh: 'ARCHIVE SEQUENCE 07 / 12' },
      en: { text: "You discover that the archive does not copy memories — it transfers them. When you preserve something, someone in the outside world loses it. A voice recording you preserved last month — a mother's final message to her child — has caused the child to forget the mother entirely." },
      zh: { text: '你发现档案馆并不复制记忆——它转移记忆。每当你保存某物，外部世界的某人就会失去它。你上个月保存的一段录音——一位母亲对孩子的最后留言——使那个孩子完全忘记了母亲。' },
      options: [
        {
          value: 'A',
          en: 'Keep it. The recording is the only thing that remains of her.',
          zh: '保留它。这段录音是她留存下来的唯一痕迹。',
          scores: { preservation: 2, authenticity: 2 }
        },
        {
          value: 'B',
          en: 'Return it to the child, even if the archive loses it forever.',
          zh: '将它归还给孩子，即使档案馆永远失去它。',
          scores: { privateMeaning: 2, sacrifice: 2, preservation: -2 }
        },
        {
          value: 'C',
          en: 'Seal it — preserve it, but let no one access it.',
          zh: '封存它——保留，但不允许任何人查阅。',
          scores: { control: 2, authenticity: 1 }
        },
        {
          value: 'D',
          en: 'Destroy it. Some losses should remain losses.',
          zh: '销毁它。有些失去就应该是失去。',
          scores: { preservation: -2, authenticity: -1, sacrifice: 1 }
        }
      ]
    },

    // Q7 — Original vs. reconstruction (choice)
    {
      id: 7, act: 3, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 08 / 12', zh: 'ARCHIVE SEQUENCE 08 / 12' },
      en: { text: 'A manuscript was partially destroyed. A scholar has rebuilt it — not restored, but reconstructed from context, intuition, and similar texts. The archive can hold one version. Which do you keep?' },
      zh: { text: '一份手稿部分被毁。一位学者重建了它——并非修复，而是根据语境、直觉和类似文本重新构建的。档案馆只能保存一个版本。你保留哪一个？' },
      options: [
        {
          value: 'A',
          en: "The original fragment. Its incompleteness is part of its truth.",
          zh: '原始残片。其不完整性是其真相的一部分。',
          scores: { authenticity: 3, preservation: 1 }
        },
        {
          value: 'B',
          en: 'The reconstruction. Meaning matters more than provenance.',
          zh: '重建版本。意义比来源更重要。',
          scores: { authenticity: -2, privateMeaning: 1, preservation: 2 }
        },
        {
          value: 'C',
          en: 'Neither. The gap itself should be preserved, not filled.',
          zh: '两者都不保存。空白本身应该被保留，而不是被填补。',
          scores: { authenticity: 1, control: -1, preservation: -1 }
        },
        {
          value: 'D',
          en: 'Both — you reclassify something else to make space.',
          zh: '两者都保存——你重新分类其他物品来腾出空间。',
          scores: { preservation: 3, control: 2, sacrifice: 1 }
        }
      ]
    },

    // Q8 — The word (text)
    {
      id: 8, act: 3, type: 'text',
      label: { en: 'ARCHIVE SEQUENCE 09 / 12', zh: 'ARCHIVE SEQUENCE 09 / 12' },
      en: {
        text: 'The archive keeps a register of things that must not be forgotten. You may add one entry.',
        note: 'It cannot be a name, a date, or a place. Write one word — a quality, a state, something abstract that is at risk of disappearing.',
        placeholder: 'a word'
      },
      zh: {
        text: '档案馆保有一份不得遗忘之物的记录。你可以添加一条。',
        note: '它不能是姓名、日期或地点。写一个词——一种品质、一种状态、某种抽象的、处于消逝边缘的东西。',
        placeholder: '一个词'
      }
    },

    /* ── ACT IV — THE PRICE ────────────────────────────────── */

    // Q9 — Destruction (choice)
    {
      id: 9, act: 4, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 10 / 12', zh: 'ARCHIVE SEQUENCE 10 / 12' },
      en: { text: 'An irreplaceable original document has just arrived. The archive is at capacity. Something must be removed to make space.' },
      zh: { text: '一份无可替代的原始文件刚刚到达。档案馆已满。必须移除某样东西来腾出空间。' },
      options: [
        {
          value: 'A',
          en: "Remove the scholar's reconstruction — it was never authentic anyway.",
          zh: '移除学者的重建版本——它本来就不是真品。',
          scores: { authenticity: 1, control: 1 }
        },
        {
          value: 'B',
          en: 'Remove a set of records that duplicate information held elsewhere.',
          zh: '移除一套在其他地方有副本的重复记录。',
          scores: { control: 1, preservation: -1 }
        },
        {
          value: 'C',
          en: 'Remove something of your own — something you brought from your own past.',
          zh: '移除你自己的某样东西——你从自己的过去带来的。',
          scores: { sacrifice: 3 }
        },
        {
          value: 'D',
          en: 'Refuse. You will find another way. Nothing will be destroyed.',
          zh: '拒绝。你会找到其他方法。什么都不会被销毁。',
          scores: { control: -2, preservation: 2, sacrifice: -1 }
        }
      ]
    },

    // Q10 — The price (choice)
    {
      id: 10, act: 4, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 11 / 12', zh: 'ARCHIVE SEQUENCE 11 / 12' },
      en: { text: 'The archive will continue — but not without cost. The cost is yours to choose.' },
      zh: { text: '档案馆将会继续——但不是没有代价。代价由你来选择。' },
      options: [
        {
          value: 'A',
          en: 'You will lose your own name from all records.',
          zh: '你的名字将从所有记录中消失。',
          scores: { sacrifice: 2, privateMeaning: 1 }
        },
        {
          value: 'B',
          en: 'You will lose the ability to form new memories after today.',
          zh: '今天之后，你将失去形成新记忆的能力。',
          scores: { sacrifice: 2, authenticity: 1 }
        },
        {
          value: 'C',
          en: 'You will never be able to leave the archive.',
          zh: '你将永远无法离开档案馆。',
          scores: { sacrifice: 1, control: -1 }
        },
        {
          value: 'D',
          en: 'You will not pay. The archive closes.',
          zh: '你不付出代价。档案馆将关闭。',
          scores: { sacrifice: -3, preservation: -3 }
        }
      ]
    },

    // Q11 — Final preservation (choice, 5 options)
    {
      id: 11, act: 4, type: 'choice',
      label: { en: 'ARCHIVE SEQUENCE 12 / 12', zh: 'ARCHIVE SEQUENCE 12 / 12' },
      en: { text: 'The archive can make one permanent, irreversible preservation. It will outlast any human memory — but doing so will erase every trace that you ever existed. No record. No photograph. No memory in anyone who knew you.' },
      zh: { text: '档案馆可以进行一次永久性、不可逆的保存。它将比任何人类记忆都更持久——但这样做将抹去你存在过的一切痕迹。没有记录，没有照片，没有任何认识你的人的记忆。' },
      options: [
        {
          value: 'A',
          en: "The private diary — a stranger's intimate world.",
          zh: '那本私人日记——一个陌生人的私密世界。',
          scores: { privateMeaning: 3, sacrifice: 3 }
        },
        {
          value: 'B',
          en: "The city's final map — a collective, spatial memory.",
          zh: '那座城市的最后地图——一段集体的、空间性的记忆。',
          scores: { preservation: 2, sacrifice: 3, privateMeaning: -1 }
        },
        {
          value: 'C',
          en: 'The word from the register — the one you chose not to forget.',
          zh: '那份记录中的词——那个你选择不遗忘的词。',
          scores: { privateMeaning: 2, sacrifice: 2 }
        },
        {
          value: 'D',
          en: 'Nothing. No single thing is worth that price.',
          zh: '什么都不保存。没有任何东西值得付出那样的代价。',
          scores: { sacrifice: -3, preservation: -1 }
        },
        {
          value: 'E',
          en: 'Yourself — your memories, your version of everything you\'ve witnessed.',
          zh: '你自己——你的记忆，你对所见一切的叙述。',
          scores: { privateMeaning: 3, sacrifice: -1, control: 2 }
        }
      ]
    }
  ];

  /* ──────────────────────────────────────────────────────────
     ACT METADATA
  ────────────────────────────────────────────────────────── */

  var ACTS = {
    1: { en: 'ENTRY',     zh: '进入',  label: 'ACT I'   },
    2: { en: 'CONFLICT',  zh: '冲突',  label: 'ACT II'  },
    3: { en: 'FRACTURE',  zh: '断裂',  label: 'ACT III' },
    4: { en: 'THE PRICE', zh: '代价',  label: 'ACT IV'  }
  };

  /* ──────────────────────────────────────────────────────────
     ARCHETYPES
  ────────────────────────────────────────────────────────── */

  var ARCHETYPES = [
    {
      id: 'keeper',
      signature: { preservation: 0.3, privateMeaning: 1, authenticity: 0.8, control: 0.2, sacrifice: 0.4 },
      en: {
        title: 'Keeper of Unsent Letters',
        quote: 'You do not fear that things disappear. You fear that they once existed and were never truly understood.',
        description: 'You have made the archive into something that functions less like a library and more like a confessional. The things you preserve are not the things that mattered to everyone — they are the things that mattered to someone, without ever being said aloud.',
        preserves: 'Private correspondences. Unfinished thoughts. The things people made for an audience of one.',
        desire: 'To be a witness to lives that were never publicly witnessed.',
        contradiction: 'The intimacy you preserve was never meant for your eyes either.',
        archive: 'Small, dense, and inaccessible. Organized by grief rather than subject.'
      },
      zh: {
        title: '未寄出信件的保管者',
        quote: '你不怕事物消逝。你怕的是它们曾经存在，却从未被真正理解。',
        description: '你将档案馆变成了某种更像忏悔室而非图书馆的地方。你保存的不是对所有人重要的东西——而是对某人重要、却从未被说出口的东西。',
        preserves: '私人通信。未完成的思绪。那些为一个人而创作的东西。',
        desire: '见证那些从未被公开见证过的生命。',
        contradiction: '你所保存的亲密，也从未曾打算给你看。',
        archive: '小而密集，无法进入。按悲伤而非主题整理。'
      }
    },
    {
      id: 'cataloguer',
      signature: { preservation: 1, privateMeaning: -0.8, authenticity: 0.5, control: 0.8, sacrifice: 0.2 },
      en: {
        title: "Cataloguer of Civilisation's Embers",
        quote: 'Someone must count the stars before the sky closes. You have decided to be that person.',
        description: 'You are not sentimental about individual lives. You are frightened of civilisational forgetting — the kind that happens slowly, systemically, without anyone choosing it. Your archive is a map of what a species once knew.',
        preserves: 'Systems. Methods. The practical knowledge needed to rebuild.',
        desire: 'That the next civilisation, whenever it comes, does not start from nothing.',
        contradiction: 'You have preserved the knowledge of how to live, without preserving why it was worth living.',
        archive: 'Vast, methodical, cross-referenced. Colder than it was intended to be.'
      },
      zh: {
        title: '文明余烬的编目员',
        quote: '在天空合上之前，总得有人去数星星。你决定成为那个人。',
        description: '你对个体生命没有感情。你恐惧的是文明性的遗忘——那种缓慢的、系统性的、没有人主动选择的遗忘。你的档案馆是一张记录了一个物种曾经知晓之物的地图。',
        preserves: '系统。方法。重建所需的实用知识。',
        desire: '下一个文明，无论何时到来，不会从零开始。',
        contradiction: '你保存了关于如何生活的知识，却没有保存生活之所以值得的理由。',
        archive: '庞大、有条不紊、交叉索引。比原本预想的更冷漠。'
      }
    },
    {
      id: 'witness',
      signature: { preservation: 0.2, privateMeaning: 0.5, authenticity: 0.8, control: -0.8, sacrifice: 1 },
      en: {
        title: 'Witness Without a Name',
        quote: 'You understood early that the price of seeing clearly is being seen less.',
        description: 'You have paid costs others would not. You have given things away that you had no right to give away — your own history, your own continuity — because you believed something else needed to exist more than you did.',
        preserves: 'The things whose existence required your erasure.',
        desire: 'Not to be remembered, but to have been accurate.',
        contradiction: 'Your willingness to disappear makes your record of things the most partial of all.',
        archive: 'Sparse. What remains is exact. What was sacrificed in the making of it is not marked.'
      },
      zh: {
        title: '被删除姓名的见证人',
        quote: '你很早就明白：看清事物的代价，是被人更少地看见。',
        description: '你付出了别人不愿付出的代价。你放弃了你无权放弃的东西——你自己的历史，你自己的延续性——因为你相信某些别的东西比你更需要存在。',
        preserves: '那些需要你的抹去才能存在的事物。',
        desire: '不是被记住，而是曾经准确过。',
        contradiction: '你愿意消失，反而使你的记录成为了所有记录中最残缺的那一份。',
        archive: '稀疏。留存下来的十分精确。制作过程中牺牲掉的，没有任何标记。'
      }
    },
    {
      id: 'restorer',
      signature: { preservation: 0.8, privateMeaning: -0.2, authenticity: -0.8, control: 0.6, sacrifice: 0.4 },
      en: {
        title: 'Restorer of Lost Histories',
        quote: 'An incomplete map is not better than a complete one just because it is older.',
        description: 'You have no patience for the cult of the authentic fragment. A broken thing is broken. You believe preservation means making something whole enough to be used — by the living, not just the specialists.',
        preserves: 'What can be made legible again. Reconstructions that acknowledge their own seams.',
        desire: 'For lost histories to be inhabited, not just displayed.',
        contradiction: 'In making things whole, you have sometimes made them slightly different from what they were.',
        archive: 'Accessible, annotated, rebuilt. Some seams show. Others do not.'
      },
      zh: {
        title: '失落历史的修复师',
        quote: '一张不完整的地图并不因为更古老就比完整的地图更好。',
        description: '你对残片崇拜没有耐心。破损的东西就是破损的。你相信保存意味着让某样东西完整到足以被使用——被活着的人使用，而不仅仅是专家。',
        preserves: '能够被重新变得清晰可读的东西。承认自身接缝的重建。',
        desire: '让失落的历史被栖居，而不仅仅是被展示。',
        contradiction: '在让事物变完整的过程中，你有时让它们与原本的样子略有不同。',
        archive: '易于进入，有注解，经过重建。有些接缝显露出来。另一些则没有。'
      }
    },
    {
      id: 'guardian',
      signature: { preservation: -0.8, privateMeaning: -0.2, authenticity: 0.5, control: 1, sacrifice: -0.5 },
      en: {
        title: 'Guardian of the Blank Archive',
        quote: 'The most responsible act of preservation is knowing what not to preserve.',
        description: 'You are not a hoarder of the past. You are its editor. You believe that the accumulation of everything is as dangerous as the loss of everything — that a culture drowning in its own records cannot think clearly about what it actually needs.',
        preserves: 'Almost nothing. What remains has been chosen with extreme deliberation.',
        desire: 'Clarity. The kind that only comes from removal.',
        contradiction: 'Your certainty about what to discard depends on a knowledge of the past that you have largely destroyed.',
        archive: 'Nearly empty. What is there is impeccably maintained. The silence is the point.'
      },
      zh: {
        title: '空白档案的守门人',
        quote: '最负责任的保存行为，是知道什么不该保存。',
        description: '你不是过去的囤积者。你是它的编辑。你相信积累一切与失去一切同样危险——一种被自己的记录淹没的文化，无法清晰地思考它真正需要什么。',
        preserves: '几乎什么都没有。留存的东西经过了极为审慎的选择。',
        desire: '清晰。那种只有通过删减才能获得的清晰。',
        contradiction: '你关于应该丢弃什么的确信，依赖于一种你已基本销毁的过去知识。',
        archive: '几近空旷。留存之物保管完美。沉默本身就是重点。'
      }
    },
    {
      id: 'gardener',
      signature: { preservation: 0.5, privateMeaning: 0.8, authenticity: 0.3, control: -0.8, sacrifice: 0.9 },
      en: {
        title: 'Gardener of the Final Greenhouse',
        quote: 'You kept the seeds, not the photographs. You understood that what can grow is different from what can be looked at.',
        description: 'You are not preserving the past. You are trying to preserve the possibility of a future. What you save is not the record of what was — it is the material from which something entirely new could still be made.',
        preserves: 'Living things. Potential. The unrealised.',
        desire: 'That something survives in a form capable of change.',
        contradiction: 'What you have preserved cannot be predicted or controlled, which means it may become something you would not have chosen.',
        archive: 'Humid. Growing. What is inside it is not fixed. The archive tends itself.'
      },
      zh: {
        title: '最后一座温室的园丁',
        quote: '你保存了种子，而不是照片。你明白能够生长的东西不同于能够被观看的东西。',
        description: '你并不是在保存过去。你试图保存的是未来的可能性。你保存的不是曾经发生之事的记录——而是某种全新事物仍有可能从中生长出来的材料。',
        preserves: '活着的东西。潜力。尚未实现的事物。',
        desire: '某些东西能以一种可以改变的形式存活下来。',
        contradiction: '你所保存的东西无法被预测或控制，这意味着它可能变成你本不会选择的样子。',
        archive: '潮湿，生长着。内部的东西不是固定的。档案馆自我照料。'
      }
    },
    {
      id: 'collector',
      signature: { preservation: 0.4, privateMeaning: 1, authenticity: -0.5, control: -0.3, sacrifice: 0.2 },
      en: {
        title: 'Collector of Dream Specimens',
        quote: 'What you have kept would not survive peer review. That is precisely why you kept it.',
        description: 'Your archive resists categorisation. You have preserved things that most archivists would have discarded — not because they are important by any legible standard, but because something in them was irreducible, resistant to summary, impossible to transmit any other way.',
        preserves: 'The subjective. The atmospheric. The things that can only be felt, not explained.',
        desire: 'For the strange, the minor, and the peripheral to be taken seriously.',
        contradiction: 'Your archive is extraordinarily personal. Which means it is, in some fundamental sense, only legible to you.',
        archive: 'Densely organised according to a system no one else fully understands.'
      },
      zh: {
        title: '梦境标本的采集者',
        quote: '你所保存的东西不会通过同行评审。这正是你保存它的原因。',
        description: '你的档案馆抵制分类。你保存了大多数档案员会丢弃的东西——不是因为它们按任何可理解的标准来说很重要，而是因为它们当中有某种不可化约的东西，抗拒摘要，无法以任何其他方式传递。',
        preserves: '主观的。氛围性的。只能被感受、不能被解释的东西。',
        desire: '让奇异的、次要的和边缘的东西被认真对待。',
        contradiction: '你的档案极度个人化。这意味着从某种根本意义上，它只对你自己是清晰可读的。',
        archive: '按一套没有人完全理解的系统密集整理。'
      }
    },
    {
      id: 'closer',
      signature: { preservation: -1, privateMeaning: 0, authenticity: -0.3, control: -0.5, sacrifice: 0.8 },
      en: {
        title: 'The One Who Closed the Archive',
        quote: 'There is a kind of responsibility that looks like abandonment from the outside.',
        description: 'You did not fail to preserve. You decided, with full knowledge of what you were doing, that preservation itself had become the problem. The archive had grown into something that prevented the world from moving — a gravity well of the past.',
        preserves: 'Nothing, deliberately. The act of closing was the last archival decision.',
        desire: 'For what comes next to be unburdened by what came before.',
        contradiction: 'In closing the archive, you have made yourself the final record. You carry everything that was lost.',
        archive: 'Closed. Dark. Still. The door is unmarked.'
      },
      zh: {
        title: '主动关闭档案馆的人',
        quote: '有一种责任感，从外面看起来像是遗弃。',
        description: '你并非没有尽力保存。你在完全清楚自己在做什么的情况下，决定保存本身已经成为了问题。档案馆已经演变成某种阻止世界继续前行的东西——一个过去的引力井。',
        preserves: '什么都没有，这是刻意为之的。关闭这一行为，是最后一个档案决定。',
        desire: '让接下来的事物不被之前的事物所负累。',
        contradiction: '在关闭档案馆的过程中，你使自己成为了最后的记录。你背负着所有失去的东西。',
        archive: '关闭。黑暗。静止。门上没有标记。'
      }
    }
  ];

  /* ──────────────────────────────────────────────────────────
     COSTS
  ────────────────────────────────────────────────────────── */

  var COSTS = [
    {
      id: 'name',
      trigger: function (s) {
        return (s.sacrifice > 0.3 && s.privateMeaning > 0.3)
          ? (s.sacrifice + s.privateMeaning) : -Infinity;
      },
      en: "You will forget your own name. Not immediately — it will happen the way all forgetting happens, by degrees, until one day you reach for it and it is simply gone.",
      zh: "你将会忘记自己的名字。不是立刻——它会以所有遗忘发生的方式发生，逐渐地，直到某天你伸手去找它，它已经消失了。"
    },
    {
      id: 'newmemories',
      trigger: function (s) {
        return (s.preservation > 0.4 && s.authenticity > 0.4)
          ? (s.preservation + s.authenticity) : -Infinity;
      },
      en: "You will retain everything you have ever witnessed. But you will form no new memories after today. The archive will grow no further. Neither will you.",
      zh: "你将保留你曾经见证过的一切。但从今天之后，你不会形成任何新的记忆。档案馆不会再扩大。你也不会。"
    },
    {
      id: 'trapped',
      trigger: function (s) {
        return (s.control > 0.4 && s.preservation > 0.2)
          ? (s.control + s.preservation) : -Infinity;
      },
      en: "You will not be able to leave. The archive needs a keeper, and you have become indistinguishable from the role. Outside, life continues without you. In here, everything you have saved remains perfectly still.",
      zh: "你将无法离开。档案馆需要一个保管者，而你已经与这个角色难以区分。外面，生活在没有你的情况下继续。在这里，你保存的一切完全静止。"
    },
    {
      id: 'forgotten',
      trigger: function (s) {
        return (s.privateMeaning < 0 && s.preservation > 0.5)
          ? (s.preservation - s.privateMeaning) : -Infinity;
      },
      en: "Every person whose record you preserved has forgotten you. You have become a kind of absence in the lives of everyone you have documented — present in their archives, invisible in their memory.",
      zh: "每一个你为其保存了记录的人都已忘记了你。在所有你曾记录过的人的生活中，你成为了一种缺席——存在于他们的档案中，在他们的记忆里却是隐形的。"
    },
    {
      id: 'confused',
      trigger: function (s) {
        return (s.authenticity < -0.2 && s.privateMeaning > 0.3)
          ? (s.privateMeaning - s.authenticity) : -Infinity;
      },
      en: "You can no longer distinguish between your memories and the memories you have preserved. Other people's losses feel like yours. Their joys feel like yours. The boundary between keeper and kept has dissolved.",
      zh: "你再也无法区分你的记忆和你所保存的记忆。别人的失去感觉像是你的。他们的喜悦感觉像是你的。保管者与被保管者之间的边界已经消解。"
    },
    {
      id: 'frozen',
      trigger: function (s) {
        return (s.preservation > 0.6 && s.control > 0.3 && s.sacrifice < 0.2)
          ? (s.preservation + s.control - s.sacrifice) : -Infinity;
      },
      en: "You remember everything. You can change nothing. Every decision you have made in this archive is permanently recorded, including the ones you would revise if you could. The archive preserves its own keeper with perfect fidelity.",
      zh: "你记得一切。你什么都改变不了。你在这座档案馆里做出的每一个决定都被永久记录下来，包括那些如果可以你会修改的。档案馆以完美的忠实度保存了它自己的保管者。"
    }
  ];

  /* ──────────────────────────────────────────────────────────
     ENDINGS
  ────────────────────────────────────────────────────────── */

  var ENDINGS = [
    {
      id: 'forgotten_archive',
      trigger: function (s, a) {
        var base = (s.sacrifice < 0 || a[11] === 'D') ? 1 : 0;
        return base > 0 ? (base - s.sacrifice) : -Infinity;
      },
      en: "The archive survives. It is well-organized, well-maintained, and completely without context. Future visitors will find it intact and be unable to explain why it was built, what it was for, or who thought any of it mattered. It will be studied for a long time.",
      zh: "档案馆存活了下来。它井然有序，维护完好，却完全缺乏背景。未来的访客将会发现它完好无损，却无法解释它为何被建造，它的目的是什么，或者谁认为这一切有意义。它将被研究很长时间。"
    },
    {
      id: 'opened',
      trigger: function (s, a) {
        return (s.privateMeaning < 0 && s.preservation > 0.3)
          ? (s.preservation - s.privateMeaning) : -Infinity;
      },
      en: "The archive is opened to everyone. No restrictions. No curatorial guidance. People arrive and take what they want. Some things are misunderstood. Some things are found by the exact person who needed them. The archive becomes, slowly, a different kind of public space.",
      zh: "档案馆向所有人开放了。没有限制，没有策展指导。人们来了，取走他们想要的东西。有些东西被误解了。有些东西被恰好需要它的人找到了。档案馆慢慢地变成了另一种公共空间。"
    },
    {
      id: 'garden',
      trigger: function (s, a) {
        var cond1 = (s.privateMeaning > 0.4 && s.sacrifice > 0.4 && s.control < 0) ? 1 : 0;
        var cond2 = (a[11] === 'C') ? 1 : 0;
        return (cond1 || cond2)
          ? (s.privateMeaning + s.sacrifice - s.control + cond2) : -Infinity;
      },
      en: "The archive becomes something else entirely. The records remain, but they are no longer the point. Things begin to grow between the shelves. Visitors stop consulting the collection and start leaving things of their own. The archive continues to exist as a place rather than a system.",
      zh: "档案馆变成了完全不同的东西。记录还在，但它们不再是重点。架子之间开始有东西生长。访客不再查阅藏品，而是开始留下自己的东西。档案馆作为一个地方而非一个系统继续存在。"
    },
    {
      id: 'destroyed',
      trigger: function (s, a) {
        return (s.preservation < -0.4 || a[10] === 'D')
          ? (1 - s.preservation + (a[10] === 'D' ? 1 : 0)) : -Infinity;
      },
      en: "The archive is closed, and then deliberately dismantled. Not by neglect — by decision. Each object is returned to where it came from, or to the ground, or to silence. Those who built it leave without ceremony. The space it occupied becomes available for something else.",
      zh: "档案馆关闭了，然后被刻意拆除。不是因为疏忽——而是出于决定。每一件物品都被归还到它的来源之处，或归于大地，或归于沉默。建造它的人无声地离开了。它曾占据的空间，变得可以用于其他事情。"
    },
    {
      id: 'collection',
      trigger: function (s, a) {
        return (a[11] === 'E' || (s.sacrifice > 0.5 && s.privateMeaning > 0.5))
          ? (s.sacrifice + s.privateMeaning + (a[11] === 'E' ? 1 : 0)) : -Infinity;
      },
      en: "You become part of the collection. Not metaphorically. Your account of the archive — your decisions, your reasoning, your uncertainties — is the final document added before the doors close. Future archivists will argue about whether it was an act of humility or hubris to include it.",
      zh: "你成为了藏品的一部分。不是比喻意义上的。你对档案馆的叙述——你的决定、你的推理、你的不确定——是门关上之前添加的最后一份文件。未来的档案员将会争论，将其纳入究竟是谦逊之举还是傲慢之举。"
    },
    {
      id: 'preserves_all',
      trigger: function (s, a) {
        return ((a[11] === 'A' || a[11] === 'B') && s.sacrifice > 0.5)
          ? (s.sacrifice + (a[11] === 'A' || a[11] === 'B' ? 1 : 0)) : -Infinity;
      },
      en: "The archive preserves everyone who was ever brought into it. Every name, every face, every voice. Except one. The keeper's record was never filed. There is no photograph, no testimony, no date of service. The archive is complete. You are not in it.",
      zh: "档案馆保存了所有曾被带入其中的人。每一个名字，每一张面孔，每一个声音。除了一个人。保管者的档案从未被归档。没有照片，没有证词，没有服务日期。档案馆是完整的。你不在其中。"
    }
  ];

  /* ──────────────────────────────────────────────────────────
     SCORING ENGINE
  ────────────────────────────────────────────────────────── */

  var DIMS = ['preservation', 'privateMeaning', 'authenticity', 'control', 'sacrifice'];

  function zeroScores() {
    var s = {};
    DIMS.forEach(function (d) { s[d] = 0; });
    return s;
  }

  function addScores(acc, scores) {
    if (!scores) return;
    Object.keys(scores).forEach(function (k) {
      if (acc[k] !== undefined) acc[k] += scores[k];
      else acc[k] = scores[k];
    });
  }

  /* Q4 ranking scoring — position 0 = highest priority */
  function scoreRanking(order) {
    var scores = zeroScores();
    // order is array of item IDs
    order.forEach(function (itemId, pos) {
      if (itemId === 'personal') {
        var p = [3, 1, -1, -3][pos] || 0;
        scores.privateMeaning += p;
      } else if (itemId === 'maps') {
        var pres = [2, 1, -1, -2][pos] || 0;
        var priv = [-1, 0, 0, 1][pos] || 0;
        scores.preservation += pres;
        scores.privateMeaning += priv;
      } else if (itemId === 'biological') {
        if (pos === 0) { scores.sacrifice += 2; scores.preservation += 1; }
        else if (pos === 1) { scores.preservation += 1; }
        else if (pos === 3) { scores.preservation -= 1; }
      } else if (itemId === 'cultural') {
        if (pos === 0) { scores.authenticity += 2; }
        else if (pos === 1) { scores.authenticity += 1; }
        else if (pos === 3) { scores.authenticity -= 1; }
      }
    });
    return scores;
  }

  /* Q5 capacity scoring */
  function scoreCapacity(alloc) {
    // alloc = { personal, scientific, art, admin } summing to ≤ 100
    var scores = zeroScores();
    var reserved = 100 - Object.values(alloc).reduce(function (a, b) { return a + b; }, 0);

    function deltaScore(units) {
      return (units - 25) / 10;
    }

    scores.privateMeaning += deltaScore(alloc.personal || 0);
    scores.preservation   += deltaScore(alloc.scientific || 0) * 0.7;
    scores.control        += deltaScore(alloc.scientific || 0) * 0.3;
    scores.authenticity   += deltaScore(alloc.art || 0) * 0.6;
    scores.privateMeaning += deltaScore(alloc.art || 0) * 0.4;
    scores.control        += deltaScore(alloc.admin || 0) * 0.6;
    scores.preservation   += deltaScore(alloc.admin || 0) * 0.2;
    scores.privateMeaning -= deltaScore(alloc.admin || 0) * 0.2;

    // Reserved units bonus
    var reservedBonus = Math.floor(reserved / 10) * 1;
    scores.sacrifice += reservedBonus;

    return scores;
  }

  function calculateScores(answers) {
    var acc = zeroScores();

    QUESTIONS.forEach(function (q) {
      var ans = answers[q.id];
      if (ans == null) return;

      if (q.type === 'choice') {
        var opt = q.options.find(function (o) { return o.value === ans; });
        if (opt) addScores(acc, opt.scores);
      } else if (q.type === 'ranking') {
        var rs = scoreRanking(ans);
        addScores(acc, rs);
      } else if (q.type === 'capacity') {
        var cs = scoreCapacity(ans);
        addScores(acc, cs);
      }
      // text (Q8): no scoring
    });

    return acc;
  }

  function normalizeScores(raw) {
    var NORM_CAP = 10;
    var norm = {};
    DIMS.forEach(function (d) {
      norm[d] = Math.max(-1, Math.min(1, (raw[d] || 0) / NORM_CAP));
    });
    return norm;
  }

  function dotProduct(a, b) {
    return DIMS.reduce(function (sum, d) {
      return sum + (a[d] || 0) * (b[d] || 0);
    }, 0);
  }

  function vecMag(v) {
    return Math.sqrt(DIMS.reduce(function (sum, d) {
      return sum + (v[d] || 0) * (v[d] || 0);
    }, 0));
  }

  function cosineSim(a, b) {
    var magA = vecMag(a);
    var magB = vecMag(b);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct(a, b) / (magA * magB);
  }

  function determineArchetype(norm) {
    var bestIdx = 0;
    var bestSim = -Infinity;
    ARCHETYPES.forEach(function (arch, i) {
      var sim = cosineSim(norm, arch.signature);
      if (sim > bestSim) { bestSim = sim; bestIdx = i; }
    });
    return ARCHETYPES[bestIdx];
  }

  function determineCost(norm, answers) {
    var bestIdx = 0;
    var bestVal = -Infinity;
    COSTS.forEach(function (cost, i) {
      var val = cost.trigger(norm, answers);
      if (val > bestVal) { bestVal = val; bestIdx = i; }
    });
    return COSTS[bestIdx];
  }

  function determineEnding(norm, answers) {
    var bestIdx = 0;
    var bestVal = -Infinity;
    ENDINGS.forEach(function (ending, i) {
      var val = ending.trigger(norm, answers);
      if (val > bestVal) { bestVal = val; bestIdx = i; }
    });
    return ENDINGS[bestIdx];
  }

  function computeResult() {
    var raw  = calculateScores(state.answers);
    var norm = normalizeScores(raw);
    var arch = determineArchetype(norm);
    var cost = determineCost(norm, state.answers);
    var end  = determineEnding(norm, state.answers);
    return {
      archetypeId: arch.id,
      costId: cost.id,
      endingId: end.id,
      scores: norm
    };
  }

  /* ──────────────────────────────────────────────────────────
     DEFAULT RANKING & ALLOCATION
  ────────────────────────────────────────────────────────── */

  function defaultRankingOrder() {
    return QUESTIONS[4].items.map(function (item) { return item.id; });
  }

  function defaultAllocation() {
    return { personal: 25, scientific: 25, art: 25, admin: 25 };
  }

  /* ──────────────────────────────────────────────────────────
     DRAG-AND-DROP (ranking question)
  ────────────────────────────────────────────────────────── */

  var dragState = {
    dragIdx: null,
    overIdx: null
  };

  function attachDragHandlers(list, order, onReorder) {
    var items = list.querySelectorAll('.arc-rank-item');

    items.forEach(function (item, idx) {
      // Mouse drag
      item.addEventListener('dragstart', function (e) {
        dragState.dragIdx = idx;
        item.classList.add('arc-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });

      item.addEventListener('dragend', function () {
        item.classList.remove('arc-dragging');
        if (dragState.overIdx !== null && dragState.overIdx !== dragState.dragIdx) {
          var newOrder = order.slice();
          var moved = newOrder.splice(dragState.dragIdx, 1)[0];
          newOrder.splice(dragState.overIdx, 0, moved);
          onReorder(newOrder);
        }
        dragState.dragIdx = null;
        dragState.overIdx = null;
      });

      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragState.overIdx !== idx) {
          list.querySelectorAll('.arc-rank-item').forEach(function (el) {
            el.classList.remove('arc-drag-over');
          });
          item.classList.add('arc-drag-over');
          dragState.overIdx = idx;
        }
      });

      item.addEventListener('dragleave', function () {
        item.classList.remove('arc-drag-over');
      });

      item.addEventListener('drop', function (e) {
        e.preventDefault();
        item.classList.remove('arc-drag-over');
      });

      // Touch drag (simple swap via touchmove)
      var touchStartY = null;

      item.addEventListener('touchstart', function (e) {
        dragState.dragIdx = idx;
        touchStartY = e.touches[0].clientY;
        item.classList.add('arc-dragging');
      }, { passive: true });

      item.addEventListener('touchmove', function (e) {
        var touch = e.touches[0];
        var el = document.elementFromPoint(touch.clientX, touch.clientY);
        var target = el && el.closest('.arc-rank-item');
        if (target && target !== item) {
          var targetItems = Array.from(list.querySelectorAll('.arc-rank-item'));
          var targetIdx = targetItems.indexOf(target);
          if (targetIdx !== -1) {
            list.querySelectorAll('.arc-rank-item').forEach(function (ri) {
              ri.classList.remove('arc-drag-over');
            });
            target.classList.add('arc-drag-over');
            dragState.overIdx = targetIdx;
          }
        }
      }, { passive: true });

      item.addEventListener('touchend', function () {
        item.classList.remove('arc-dragging');
        list.querySelectorAll('.arc-rank-item').forEach(function (ri) {
          ri.classList.remove('arc-drag-over');
        });
        if (dragState.overIdx !== null && dragState.overIdx !== dragState.dragIdx) {
          var newOrder = order.slice();
          var moved = newOrder.splice(dragState.dragIdx, 1)[0];
          newOrder.splice(dragState.overIdx, 0, moved);
          onReorder(newOrder);
        }
        dragState.dragIdx = null;
        dragState.overIdx = null;
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     RADAR CHART (SVG)
  ────────────────────────────────────────────────────────── */

  function buildRadarChart(scores) {
    var size   = 200;
    var cx     = size / 2;
    var cy     = size / 2;
    var radius = 72;
    var padding = 28; // space for labels

    var totalSize = size + padding * 2;

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + totalSize + ' ' + totalSize,
      'class': 'arc-radar-svg',
      role: 'img',
      'aria-label': t('Radar chart of your archival tendencies', '你档案倾向的雷达图')
    });

    var dims = [
      { key: 'preservation',   en: 'PRESERVATION',   zh: '保存' },
      { key: 'privateMeaning', en: 'PRIVATE',         zh: '私密' },
      { key: 'authenticity',   en: 'AUTHENTICITY',    zh: '真实' },
      { key: 'control',        en: 'CONTROL',         zh: '控制' },
      { key: 'sacrifice',      en: 'SACRIFICE',       zh: '牺牲' }
    ];

    var n = dims.length;
    var offset = cx + padding;
    var coffset = cy + padding;

    // Compute angle for each axis (start at top, go clockwise)
    function angle(i) {
      return (Math.PI * 2 * i / n) - Math.PI / 2;
    }

    // Grid rings
    [0.25, 0.5, 0.75, 1].forEach(function (frac) {
      var pts = dims.map(function (_, i) {
        var a = angle(i);
        var r = radius * frac;
        return (offset + r * Math.cos(a)) + ',' + (coffset + r * Math.sin(a));
      });
      var poly = svgEl('polygon', {
        points: pts.join(' '),
        'class': 'arc-radar-grid'
      });
      svg.appendChild(poly);
    });

    // Axes
    dims.forEach(function (_, i) {
      var a = angle(i);
      var line = svgEl('line', {
        x1: offset, y1: coffset,
        x2: offset + radius * Math.cos(a),
        y2: coffset + radius * Math.sin(a),
        'class': 'arc-radar-axis'
      });
      svg.appendChild(line);
    });

    // Data shape — normalize -1..1 to 0..1 for radius
    var dataPts = dims.map(function (d, i) {
      var val  = scores[d.key] || 0;
      var norm = (val + 1) / 2; // map -1..1 → 0..1
      var r    = radius * norm;
      var a    = angle(i);
      return (offset + r * Math.cos(a)) + ',' + (coffset + r * Math.sin(a));
    });

    var shape = svgEl('polygon', {
      points: dataPts.join(' '),
      'class': 'arc-radar-shape'
    });
    svg.appendChild(shape);

    // Dots on vertices
    dims.forEach(function (d, i) {
      var val  = scores[d.key] || 0;
      var norm = (val + 1) / 2;
      var r    = radius * norm;
      var a    = angle(i);
      var dot  = svgEl('circle', {
        cx: offset + r * Math.cos(a),
        cy: coffset + r * Math.sin(a),
        r: 3,
        'class': 'arc-radar-dot'
      });
      svg.appendChild(dot);
    });

    // Labels
    var labelRadius = radius + 18;
    dims.forEach(function (d, i) {
      var a    = angle(i);
      var lx   = offset + labelRadius * Math.cos(a);
      var ly   = coffset + labelRadius * Math.sin(a);
      var text = svgEl('text', {
        x: lx,
        y: ly + 3.5,
        'class': 'arc-radar-label',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle'
      });
      text.textContent = state.lang === 'zh' ? d.zh : d.en;
      svg.appendChild(text);
    });

    return svg;
  }

  /* ──────────────────────────────────────────────────────────
     TRANSITION HELPERS
  ────────────────────────────────────────────────────────── */

  function fadeOut(node, cb) {
    if (REDUCED_MOTION) { cb(); return; }
    node.classList.add('arc-fade-out');
    node.addEventListener('animationend', cb, { once: true });
  }

  function fadeIn(node) {
    if (REDUCED_MOTION) return;
    node.classList.remove('arc-fade-in');
    // Force reflow
    void node.offsetWidth;
    node.classList.add('arc-fade-in');
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: INTRO
  ────────────────────────────────────────────────────────── */

  function renderIntro(container) {
    var div = el('div', { className: 'arc-intro' });

    var title = el('h1', { className: 'arc-intro-title' }, [
      t('The Last Archive', '最后的档案馆'),
      el('span', { className: 'arc-intro-subtitle' }, [
        t('最后的档案馆', 'The Last Archive')
      ])
    ]);

    var body = el('p', { className: 'arc-intro-body' }, [
      t(
        'Somewhere, there is an archive. It contains the last copies of things that no longer exist anywhere else. You are its keeper.',
        '某处，有一座档案馆。它保存着那些在其他任何地方都不再存在的事物的最后副本。你是它的保管者。'
      )
    ]);

    var body2 = el('p', { className: 'arc-intro-body' }, [
      t(
        'You will be asked twelve questions. There are no correct answers. At the end, you will receive a record of what kind of keeper you have been.',
        '你将被问及十二个问题。没有正确答案。最后，你将得到一份记录，记录你成为了哪种保管者。'
      )
    ]);

    var meta = el('p', { className: 'arc-intro-meta' }, [
      t('12 QUESTIONS · 4 ACTS · APPROXIMATELY 8–12 MINUTES',
        '12个问题 · 4幕 · 约8至12分钟')
    ]);

    var startBtn = el('button', {
      className: 'arc-btn arc-btn--primary',
      type: 'button'
    }, [t('Enter the Archive', '进入档案馆')]);

    startBtn.addEventListener('click', function () {
      goToStep(0);
    });

    div.appendChild(title);
    div.appendChild(body);
    div.appendChild(body2);
    div.appendChild(meta);
    div.appendChild(startBtn);

    container.appendChild(div);
    fadeIn(div);
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: QUESTION
  ────────────────────────────────────────────────────────── */

  function renderQuestion(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var lang = state.lang;
    var qData = q[lang];

    // Progress bar fill
    var progress = ((qIdx + 1) / 12) * 100;

    var wrap = el('div', { className: 'arc-content' });

    // Progress row
    var progressWrap = el('div', { className: 'arc-progress-wrap' });
    var progressBg   = el('div', { className: 'arc-progress-bar-bg' });
    var progressFill = el('div', {
      className: 'arc-progress-bar-fill',
      style: { width: progress + '%' }
    });
    progressBg.appendChild(progressFill);
    progressWrap.appendChild(progressBg);
    wrap.appendChild(progressWrap);

    // Act announcement (first question of a new act)
    var firstQsOfAct = { 0: 1, 3: 2, 6: 3, 9: 4 };
    if (firstQsOfAct[qIdx] !== undefined) {
      var actNum = firstQsOfAct[qIdx];
      var actData = ACTS[actNum];
      var actAnnounce = el('div', { className: 'arc-act-announce' }, [
        el('div', { className: 'arc-act-announce-number' }, [actData.label]),
        el('div', { className: 'arc-act-announce-name' }, [t(actData.en, actData.zh)])
      ]);
      wrap.appendChild(actAnnounce);
    }

    // Sequence label
    var seqLabel = el('div', { className: 'arc-label' }, [
      q.label[lang] || q.label.en
    ]);
    wrap.appendChild(seqLabel);

    // Question text
    var qText = el('p', { className: 'arc-question-text' }, [qData.text]);
    wrap.appendChild(qText);

    // Optional note
    if (qData.note) {
      var noteEl = el('p', { className: 'arc-question-note' }, [qData.note]);
      wrap.appendChild(noteEl);
    }

    // Question-type specific rendering
    if (q.type === 'choice') {
      renderChoices(wrap, q, qIdx);
    } else if (q.type === 'ranking') {
      renderRanking(wrap, q, qIdx);
    } else if (q.type === 'capacity') {
      renderCapacity(wrap, q, qIdx);
    } else if (q.type === 'text') {
      renderTextInput(wrap, q, qIdx);
    }

    // Navigation
    var nav = el('div', { className: 'arc-nav' });

    if (qIdx > 0) {
      var backBtn = el('button', { className: 'arc-btn arc-btn--ghost', type: 'button' },
        [t('← Back', '← 返回')]);
      backBtn.addEventListener('click', function () {
        goToStep(qIdx - 1);
      });
      nav.appendChild(backBtn);
    }

    wrap.appendChild(nav);

    container.appendChild(wrap);
    fadeIn(wrap);
  }

  /* ── Choice Question ───────────────────────────────────── */

  function renderChoices(wrap, q, qIdx) {
    var lang = state.lang;
    var currentAnswer = state.answers[qIdx];
    var choices = el('div', { className: 'arc-choices', role: 'group' });

    var keys = ['A','B','C','D','E'];

    q.options.forEach(function (opt, i) {
      var isSelected = currentAnswer === opt.value;
      var btn = el('button', {
        className: 'arc-choice' + (isSelected ? ' arc-selected' : ''),
        type: 'button',
        'data-value': opt.value
      }, [
        el('span', { className: 'arc-choice-key' }, [keys[i]]),
        el('span', { className: 'arc-choice-text' }, [opt[lang] || opt.en])
      ]);

      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      btn.addEventListener('click', function () {
        state.answers[qIdx] = opt.value;
        saveState();
        // Advance after short delay for visual feedback
        setTimeout(function () { advanceStep(qIdx); }, 180);
      });

      choices.appendChild(btn);
    });

    wrap.appendChild(choices);
  }

  /* ── Ranking Question ──────────────────────────────────── */

  function renderRanking(wrap, q, qIdx) {
    var lang = state.lang;
    var order = state.answers[qIdx] || defaultRankingOrder();

    var listEl = el('ol', { className: 'arc-ranking-list' });

    function rebuildList() {
      listEl.innerHTML = '';
      order.forEach(function (itemId, pos) {
        var item = q.items.find(function (it) { return it.id === itemId; });
        var row = el('li', {
          className: 'arc-rank-item',
          draggable: true,
          'data-id': itemId
        }, [
          el('span', { className: 'arc-rank-handle', 'aria-hidden': 'true' }, ['⠿']),
          el('span', { className: 'arc-rank-pos' }, [String(pos + 1)]),
          el('span', { className: 'arc-rank-text' }, [item[lang] || item.en]),
          el('span', { className: 'arc-rank-arrows' }, [
            el('button', {
              className: 'arc-rank-arrow',
              type: 'button',
              disabled: pos === 0,
              title: t('Move up', '上移'),
              'aria-label': t('Move up', '上移')
            }, ['↑']),
            el('button', {
              className: 'arc-rank-arrow',
              type: 'button',
              disabled: pos === order.length - 1,
              title: t('Move down', '下移'),
              'aria-label': t('Move down', '下移')
            }, ['↓'])
          ])
        ]);

        // Arrow button handlers
        var arrows = row.querySelectorAll('.arc-rank-arrow');
        arrows[0].addEventListener('click', function () {
          if (pos === 0) return;
          var newOrder = order.slice();
          var tmp = newOrder[pos - 1];
          newOrder[pos - 1] = newOrder[pos];
          newOrder[pos] = tmp;
          order = newOrder;
          state.answers[qIdx] = order;
          saveState();
          rebuildList();
        });
        arrows[1].addEventListener('click', function () {
          if (pos === order.length - 1) return;
          var newOrder = order.slice();
          var tmp = newOrder[pos + 1];
          newOrder[pos + 1] = newOrder[pos];
          newOrder[pos] = tmp;
          order = newOrder;
          state.answers[qIdx] = order;
          saveState();
          rebuildList();
        });

        listEl.appendChild(row);
      });

      // Re-attach drag handlers
      attachDragHandlers(listEl, order, function (newOrder) {
        order = newOrder;
        state.answers[qIdx] = order;
        saveState();
        rebuildList();
      });
    }

    rebuildList();
    wrap.appendChild(listEl);

    // Confirm button
    var confirmBtn = el('button', {
      className: 'arc-btn arc-btn--primary',
      type: 'button'
    }, [t('Confirm Order', '确认顺序')]);
    confirmBtn.addEventListener('click', function () {
      state.answers[qIdx] = order;
      saveState();
      advanceStep(qIdx);
    });
    wrap.appendChild(confirmBtn);
  }

  /* ── Capacity Question ─────────────────────────────────── */

  function renderCapacity(wrap, q, qIdx) {
    var lang = state.lang;
    var alloc = state.answers[qIdx]
      ? Object.assign({}, state.answers[qIdx])
      : defaultAllocation();

    var valueEls = {};
    var sliders  = {};
    var remainEl = el('div', { className: 'arc-capacity-remaining' });

    function getTotal() {
      return Object.values(alloc).reduce(function (a, b) { return a + b; }, 0);
    }

    function updateRemaining() {
      var total     = getTotal();
      var remaining = 100 - total;
      remainEl.textContent = t(
        remaining + ' units unallocated (reserved)',
        remaining + ' 单位未分配（封存备用）'
      );
      remainEl.className = 'arc-capacity-remaining' + (remaining < 0 ? ' arc-warn' : '');
    }

    function clampOthers(changedId, newVal) {
      var delta  = newVal - alloc[changedId];
      alloc[changedId] = newVal;
      // Distribute the difference proportionally among other categories
      var otherIds = q.categories.map(function (c) { return c.id; })
        .filter(function (id) { return id !== changedId; });
      var totalOther = otherIds.reduce(function (s, id) { return s + alloc[id]; }, 0);
      var remaining  = 100 - newVal;

      if (remaining < 0) {
        // Cap the changed slider itself
        alloc[changedId] = 100 - (totalOther);
        if (alloc[changedId] < 0) alloc[changedId] = 0;
      } else {
        // Clamp others so total doesn't exceed 100
        // Scale others proportionally
        var afterDelta = 100 - newVal;
        if (totalOther > afterDelta) {
          var scale = afterDelta / totalOther;
          otherIds.forEach(function (id) {
            alloc[id] = Math.round(alloc[id] * scale / 5) * 5;
          });
          // Fix rounding drift
          var s = otherIds.reduce(function (acc, id) { return acc + alloc[id]; }, 0);
          var diff = afterDelta - s;
          if (diff !== 0 && otherIds.length > 0) {
            alloc[otherIds[0]] = Math.max(0, alloc[otherIds[0]] + diff);
          }
        }
      }
      alloc[changedId] = Math.max(0, Math.min(100, alloc[changedId]));
    }

    function syncUI() {
      q.categories.forEach(function (cat) {
        if (sliders[cat.id])   sliders[cat.id].value  = alloc[cat.id];
        if (valueEls[cat.id])  valueEls[cat.id].textContent = alloc[cat.id];
      });
      updateRemaining();
    }

    var list = el('div', { className: 'arc-capacity-list' });

    q.categories.forEach(function (cat) {
      var header = el('div', { className: 'arc-capacity-header' }, [
        el('span', { className: 'arc-capacity-label' }, [cat[lang] || cat.en]),
        el('span', {
          className: 'arc-capacity-value',
          id: 'arc-cap-val-' + cat.id
        }, [String(alloc[cat.id])])
      ]);

      var slider = el('input', {
        type: 'range',
        className: 'arc-capacity-slider',
        min: 0, max: 100, step: 5,
        value: alloc[cat.id],
        id: 'arc-cap-' + cat.id,
        'aria-label': cat[lang] || cat.en,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(alloc[cat.id])
      });

      valueEls[cat.id] = header.querySelector('#arc-cap-val-' + cat.id);
      sliders[cat.id]  = slider;

      slider.addEventListener('input', function () {
        var newVal = parseInt(slider.value, 10);
        clampOthers(cat.id, newVal);
        syncUI();
        state.answers[qIdx] = Object.assign({}, alloc);
        saveState();
      });

      var item = el('div', { className: 'arc-capacity-item' }, [header, slider]);
      list.appendChild(item);
    });

    wrap.appendChild(list);
    wrap.appendChild(remainEl);
    updateRemaining();

    var confirmBtn = el('button', {
      className: 'arc-btn arc-btn--primary',
      type: 'button'
    }, [t('Confirm Allocation', '确认分配')]);
    confirmBtn.addEventListener('click', function () {
      state.answers[qIdx] = Object.assign({}, alloc);
      saveState();
      advanceStep(qIdx);
    });
    wrap.appendChild(confirmBtn);
  }

  /* ── Text Input Question ───────────────────────────────── */

  function renderTextInput(wrap, q, qIdx) {
    var lang = state.lang;
    var qData = q[lang];

    var wordWrap = el('div', { className: 'arc-word-wrap' });
    var input = el('input', {
      type: 'text',
      className: 'arc-word-input',
      placeholder: qData.placeholder,
      value: state.wordInput || '',
      maxLength: 80,
      'aria-label': qData.text
    });

    input.addEventListener('input', function () {
      state.wordInput = input.value;
      saveState();
    });

    wordWrap.appendChild(input);
    wrap.appendChild(wordWrap);

    var nav = wrap.querySelector('.arc-nav');
    var continueBtn = el('button', {
      className: 'arc-btn arc-btn--primary',
      type: 'button'
    }, [t('Continue', '继续')]);
    continueBtn.addEventListener('click', function () {
      state.wordInput = input.value;
      state.answers[qIdx] = input.value;
      saveState();
      advanceStep(qIdx);
    });

    // Insert before the nav div if exists
    if (nav) {
      wrap.insertBefore(continueBtn, nav);
    } else {
      wrap.appendChild(continueBtn);
    }

    // Focus after render
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: PROCESSING (interstitial before result)
  ────────────────────────────────────────────────────────── */

  function renderProcessing(container) {
    var lines = [
      t('The archive is reviewing your decisions…', '档案馆正在回顾你的决定……'),
      t('Cross-referencing with the catalogue…', '正在与目录进行交叉索引……'),
      t('Preparing your record…', '正在准备你的记录……')
    ];

    var div = el('div', { className: 'arc-processing-screen' });
    var rule = el('div', { className: 'arc-processing-rule' });
    var lineEl = el('p', { className: 'arc-processing-text' }, [lines[0]]);
    var rule2  = el('div', { className: 'arc-processing-rule' });

    div.appendChild(rule);
    div.appendChild(lineEl);
    div.appendChild(rule2);
    container.appendChild(div);
    fadeIn(div);

    // Cycle through atmospheric lines every ~900ms
    var idx = 0;
    var interval = setInterval(function () {
      idx = (idx + 1) % lines.length;
      lineEl.textContent = lines[idx];
    }, 900);

    // Clean up interval when this node is removed from the DOM
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.removedNodes.forEach(function (n) {
          if (n === div || (n.contains && n.contains(div))) {
            clearInterval(interval);
            observer.disconnect();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: RESULT
  ────────────────────────────────────────────────────────── */

  function renderResult(container) {
    var result = state.result;
    var lang   = state.lang;

    var arch = ARCHETYPES.find(function (a) { return a.id === result.archetypeId; });
    var cost = COSTS.find(function (c) { return c.id === result.costId; });
    var end  = ENDINGS.find(function (e) { return e.id === result.endingId; });

    var archData = arch[lang];
    var div = el('div', { className: 'arc-result' });

    /* ── Header: archetype ── */
    var header = el('div', { className: 'arc-result-header' });
    header.appendChild(el('div', { className: 'arc-archetype-label' }, [
      t('YOUR ARCHETYPE', '你的档案原型')
    ]));
    header.appendChild(el('h2', { className: 'arc-archetype-title' }, [archData.title]));
    header.appendChild(el('blockquote', { className: 'arc-archetype-quote' }, [archData.quote]));
    div.appendChild(header);

    /* ── Description ── */
    var descSec = el('div', { className: 'arc-result-section' });
    descSec.appendChild(el('div', { className: 'arc-result-section-label' }, [
      t('THE ARCHIVE', '档案馆')
    ]));
    descSec.appendChild(el('p', { className: 'arc-result-body' }, [archData.description]));
    div.appendChild(descSec);

    /* ── Profile grid ── */
    var profileSec = el('div', { className: 'arc-result-section' });
    profileSec.appendChild(el('div', { className: 'arc-result-section-label' }, [
      t('PROFILE', '档案侧写')
    ]));
    var grid = el('div', { className: 'arc-result-meta-grid' });

    var profileFields = [
      { key: 'preserves',     en: 'PRESERVES',     zh: '保存的' },
      { key: 'desire',        en: 'DESIRE',         zh: '渴望' },
      { key: 'contradiction', en: 'CONTRADICTION',  zh: '矛盾' },
      { key: 'archive',       en: 'THE ARCHIVE',    zh: '档案馆' }
    ];

    profileFields.forEach(function (f) {
      grid.appendChild(el('span', { className: 'arc-result-meta-key' }, [
        lang === 'zh' ? f.zh : f.en
      ]));
      grid.appendChild(el('span', { className: 'arc-result-meta-val' }, [
        archData[f.key] || ''
      ]));
    });
    profileSec.appendChild(grid);
    div.appendChild(profileSec);

    /* ── Word input ── */
    if (state.wordInput && state.wordInput.trim()) {
      var wordSec = el('div', { className: 'arc-result-section' });
      wordSec.appendChild(el('p', { className: 'arc-word-recorded' }, [
        t('You recorded: ', '你记录的词：'),
        el('span', {}, [state.wordInput.trim()])
      ]));
      div.appendChild(wordSec);
    }

    /* ── Radar chart ── */
    var chartSec = el('div', { className: 'arc-result-section' });
    chartSec.appendChild(el('div', { className: 'arc-result-section-label' }, [
      t('DIMENSIONS', '维度分析')
    ]));
    var radarWrap = el('div', { className: 'arc-radar-wrap' });
    radarWrap.appendChild(buildRadarChart(result.scores));
    chartSec.appendChild(radarWrap);
    div.appendChild(chartSec);

    /* ── Cost ── */
    var costSec = el('div', { className: 'arc-result-section' });
    costSec.appendChild(el('div', { className: 'arc-result-section-label' }, [
      t('THE COST', '代价')
    ]));
    var costBox = el('div', { className: 'arc-cost-box' });
    costBox.appendChild(el('p', { className: 'arc-cost-text' }, [cost[lang]]));
    costSec.appendChild(costBox);
    div.appendChild(costSec);

    /* ── Ending ── */
    var endSec = el('div', { className: 'arc-result-section' });
    endSec.appendChild(el('div', { className: 'arc-result-section-label' }, [
      t('WHAT REMAINS', '留存之物')
    ]));
    endSec.appendChild(el('p', { className: 'arc-ending-text' }, [end[lang]]));
    div.appendChild(endSec);

    /* ── Actions ── */
    var actions = el('div', { className: 'arc-result-actions' });

    var restartBtn = el('button', {
      className: 'arc-btn',
      type: 'button'
    }, [t('Restart', '重新开始')]);
    restartBtn.addEventListener('click', function () {
      clearState();
      resetState();
      render();
    });

    var copyBtn = el('button', {
      className: 'arc-btn',
      type: 'button'
    }, [t('Copy Summary', '复制结果摘要')]);
    copyBtn.addEventListener('click', function () {
      copyResult(arch, lang);
    });

    var shareBtn = el('button', {
      className: 'arc-btn arc-btn--primary',
      type: 'button'
    }, [t('Share', '分享')]);
    shareBtn.addEventListener('click', function () {
      shareResult(arch, lang, copyResult.bind(null, arch, lang));
    });

    actions.appendChild(restartBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(shareBtn);
    div.appendChild(actions);

    container.appendChild(div);
    fadeIn(div);
  }

  /* ──────────────────────────────────────────────────────────
     COPY / SHARE
  ────────────────────────────────────────────────────────── */

  function buildSummaryText(arch, lang) {
    var archData = arch[lang];
    return [
      'THE LAST ARCHIVE / 最后的档案馆',
      archData.title,
      '"' + archData.quote + '"',
      window.location.href
    ].join('\n');
  }

  function copyResult(arch, lang) {
    var text = buildSummaryText(arch, lang);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = el('textarea', {
      style: { position: 'fixed', top: '-9999px', left: '-9999px', opacity: '0' }
    });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function shareResult(arch, lang, fallback) {
    var archData = arch[lang];
    var text = buildSummaryText(arch, lang);
    if (navigator.share) {
      navigator.share({
        title: t('The Last Archive', '最后的档案馆'),
        text: archData.title + '\n"' + archData.quote + '"',
        url: window.location.href
      }).catch(function () { fallback(); });
    } else {
      fallback();
    }
  }

  /* ──────────────────────────────────────────────────────────
     STEP MANAGEMENT
  ────────────────────────────────────────────────────────── */

  function advanceStep(currentIdx) {
    if (currentIdx < 11) {
      goToStep(currentIdx + 1);
    } else {
      // All questions answered — show processing screen, then reveal result
      state.step = 'processing';
      saveState();
      render();
      // After 2.8 seconds, compute result and advance
      setTimeout(function () {
        state.result = computeResult();
        state.step   = 'result';
        saveState();
        render();
      }, 2800);
    }
  }

  function goToStep(stepVal) {
    state.step = stepVal;
    saveState();
    render();
  }

  function resetState() {
    state.step            = 'intro';
    state.answers         = {};
    state.rankingState    = {};
    state.allocationState = {};
    state.wordInput       = '';
    state.result          = null;
  }

  /* ──────────────────────────────────────────────────────────
     MAIN RENDER
  ────────────────────────────────────────────────────────── */

  function render() {
    var root = document.getElementById('archive-app');
    if (!root) return;

    var step = state.step;

    // Dark mode is handled via CSS inheritance from html.theme--dark set by Anatole's theme switcher.
    // No JS manipulation needed here.

    var oldContent = root.querySelector('.arc-shell');

    function doRender() {
      root.innerHTML = '';
      var shell = el('div', { className: 'arc-shell' });
      var content = el('div', { className: 'arc-content' });

      if (step === 'intro') {
        renderIntro(content);
      } else if (step === 'processing') {
        renderProcessing(content);
      } else if (step === 'result') {
        renderResult(content);
      } else if (typeof step === 'number' && step >= 0 && step <= 11) {
        renderQuestion(content, step);
      }

      shell.appendChild(content);
      root.appendChild(shell);

      // Scroll to top smoothly
      if (!REDUCED_MOTION) {
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        root.scrollTop = 0;
      }
    }

    if (oldContent && !REDUCED_MOTION) {
      fadeOut(oldContent, doRender);
    } else {
      doRender();
    }
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */

  function init() {
    // Apply language from Hugo injection (normalize 'zh-cn', 'zh-tw', etc. → 'zh')
    state.lang = normalizeLang(window.ARCHIVE_LANG);

    // Attempt to restore saved state
    var saved = loadState();
    if (saved) {
      // Validate step is in range; 'processing' is transient — restore as last question
      var validStep = saved.step === 'intro' || saved.step === 'result' ||
        (typeof saved.step === 'number' && saved.step >= 0 && saved.step <= 11);
      if (saved.step === 'processing') { saved.step = 11; validStep = true; }
      if (validStep && saved.answers && saved.lang && saved.wordInput !== undefined) {
        state.step      = saved.step;
        state.answers   = saved.answers;
        state.lang      = saved.lang;
        state.wordInput = saved.wordInput;
        state.result    = saved.result || null;
      }
    }

    // Override language from Hugo if explicitly set (takes precedence over saved)
    if (window.ARCHIVE_LANG) {
      state.lang = normalizeLang(window.ARCHIVE_LANG);
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render);
    } else {
      render();
    }
  }

  init();

})();
