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
     SCENE METADATA
  ────────────────────────────────────────────────────────── */

  var SCENES = [
    { type: 'object',   sector: ['SECTOR 01', '区域 01'], room: ['INTAKE HALL', '接收大厅'],              env: 'env-intake'    },
    { type: 'binary',   sector: ['SECTOR 02', '区域 02'], room: ['CLASSIFICATION ROOM', '分类室'],             env: 'env-classify'  },
    { type: 'document', sector: ['SECTOR 03', '区域 03'], room: ['SEALED CORRESPONDENCE', '密封信件库'], env: 'env-sealed'    },
    { type: 'document', sector: ['SECTOR 04', '区域 04'], room: ['RESTRICTED DOCUMENTS', '限制文件室'],  env: 'env-restricted'},
    { type: 'shelf',    sector: ['SECTOR 05', '区域 05'], room: ['MAP ARCHIVE', '地图档案库'],          env: 'env-maps'      },
    { type: 'storage',  sector: ['SECTOR 06', '区域 06'], room: ['STORAGE CORE', '核心储藏室'],        env: 'env-storage'   },
    { type: 'document', sector: ['SECTOR 07', '区域 07'], room: ['MEMORY VAULT', '记忆穹顶'],             env: 'env-memory'    },
    { type: 'binary',   sector: ['SECTOR 08', '区域 08'], room: ['RESTORATION LAB', '修复实验室'],    env: 'env-restore'   },
    { type: 'terminal', sector: ['SECTOR 09', '区域 09'], room: ['KEEPER TERMINAL', '保管者终端'],    env: 'env-terminal'  },
    { type: 'object',   sector: ['SECTOR 10', '区域 10'], room: ['OVERFLOW CHAMBER', '溢出仓'],               env: 'env-overflow'  },
    { type: 'contract', sector: ['SECTOR 11', '区域 11'], room: ['BINDING ROOM', '契约室'],                   env: 'env-binding'   },
    { type: 'core',     sector: ['SECTOR 12', '区域 12'], room: ['ARCHIVE CORE', '档案核心'],             env: 'env-core'      }
  ];

  /* ──────────────────────────────────────────────────────────
     VISUAL FLAGS
  ────────────────────────────────────────────────────────── */

  function getVisualFlags() {
    var a = state.answers;
    var partial = calculateScores(a);
    return {
      hasSeed:        a[0] === 'C',
      destroyedDiary: a[3] === 'A',
      preservedDiary: a[2] === 'B' || a[3] === 'B',
      chosePrivate:   (partial.privateMeaning || 0) > 0,
      highSacrifice:  (partial.sacrifice || 0) > 2
    };
  }

  function applyVisualFlags() {
    var root = document.getElementById('archive-app');
    if (!root) return;
    var f = getVisualFlags();
    root.setAttribute('data-has-seed',        f.hasSeed        ? 'true' : 'false');
    root.setAttribute('data-destroyed-diary', f.destroyedDiary ? 'true' : 'false');
    root.setAttribute('data-preserved-diary', f.preservedDiary ? 'true' : 'false');
    root.setAttribute('data-private',         f.chosePrivate   ? 'true' : 'false');
    root.setAttribute('data-sacrifice',       f.highSacrifice  ? 'true' : 'false');
  }

  /* ──────────────────────────────────────────────────────────
     STATUS BAR
  ────────────────────────────────────────────────────────── */

  function buildStatusBar(qIdx) {
    var scene = SCENES[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;
    var bar = el('div', { className: 'arc-status-bar' });
    bar.setAttribute('aria-hidden', 'true');

    var sector = el('span', { className: 'arc-status-sector' });
    sector.textContent = scene.sector[li] + '  /  ' + scene.room[li];
    bar.appendChild(sector);

    var right = el('div', { className: 'arc-status-right' });

    var cap = el('span', { className: 'arc-status-cap' });
    cap.textContent = (li === 1 ? '\u5c55\u4f4d ' : 'CAPACITY ') + (qIdx + 1) + ' / 12';
    right.appendChild(cap);

    var flags = getVisualFlags();
    var sys = el('span', { className: flags.highSacrifice ? 'arc-status-sys arc-status-sys--warn' : 'arc-status-sys' });
    sys.textContent = flags.highSacrifice
      ? (li === 1 ? '\u26a0 \u4e0d\u7a33\u5b9a' : '\u26a0 UNSTABLE')
      : (li === 1 ? '\u7a33\u5b9a' : 'STABLE');
    right.appendChild(sys);

    bar.appendChild(right);
    return bar;
  }

  /* ──────────────────────────────────────────────────────────
     CONSEQUENCE OVERLAY
  ────────────────────────────────────────────────────────── */

  var CSEQ = {
    3: {
      A: ['You close the diary. The fire is small but thorough.', '你合上日记。火苗很小，但很彻底。'],
      B: ['SEALED — 100 YEARS is pressed over the cover.', '“封存—一百年”印在封面上。'],
      C: ['The pages return marked with black passages.', '页面带着黑色段落回来。'],
      D: ['You leave it. Someone else will decide.', '你离开了。由别人决定。']
    },
    6: {
      A: ['The recording stays. Somewhere, a child forgets.', '录音留了下来。某处，一个孩子忘记了。'],
      B: ['You carry it out. The archive loses it forever.', '你带着它离开。档案馆永远失去了它。'],
      C: ['Sealed. No one will hear it again.', '封存。再也没人能听到它。'],
      D: ['Destroyed. Some losses should remain losses.', '消毁。有些失去就应该是失去。']
    },
    9: {
      C: ['Something of yours. The shelf is lighter.', '你自己的某样东西。书架轻了一点。'],
      D: ['You refuse. The archive holds its breath.', '你拒绝了。档案馆棒住了呀山。']
    },
    11: {
      A: ['The card slot accepts it. Your name begins to fade.', '卡槽接受了它。你的名字开始消退。'],
      B: ['The lever moves with unexpected ease.', '擬丝移动得出乎意料地顺畅。'],
      C: ['The door opens. Then closes behind you.', '门开了。然后在你身后关上。'],
      D: ['Nothing happens. Then everything dims.', '什么都没有发生。然后一切变暗。'],
      E: ['The machine hums. Something scans you.', '机器嗡嗡作响。某种东西在扫描你。']
    }
  };

  function getConsequenceMsg(qIdx, optVal) {
    var li = state.lang === 'zh' ? 1 : 0;
    if (CSEQ[qIdx] && CSEQ[qIdx][optVal]) {
      return CSEQ[qIdx][optVal][li];
    }
    var q = QUESTIONS[qIdx];
    if (q && q.options) {
      for (var oi = 0; oi < q.options.length; oi++) {
        if (q.options[oi].value === optVal) {
          var txt = li === 1 ? q.options[oi].zh : q.options[oi].en;
          var dot = txt.indexOf('.');
          return dot > 0 ? txt.slice(0, dot + 1) : txt;
        }
      }
    }
    return li === 1 ? '已记录。' : 'Logged.';
  }

  function showConsequence(msg, then) {
    var root = document.getElementById('archive-app');
    var ov = el('div', { className: 'arc-consequence' });
    var p = el('p', { className: 'arc-consequence-text' });
    p.textContent = msg;
    ov.appendChild(p);
    root.appendChild(ov);
    if (REDUCED_MOTION) {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      then();
      return;
    }
    setTimeout(function () {
      ov.classList.add('arc-consequence-exit');
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        then();
      }, 300);
    }, 1400);
  }

  /* ──────────────────────────────────────────────────────────
     SVG ICONS
  ────────────────────────────────────────────────────────── */

  var SVG_ICONS = {
    diary:       '<rect x="10" y="7" width="22" height="30" rx="1"/><line x1="14" y1="17" x2="28" y2="17"/><line x1="14" y1="23" x2="28" y2="23"/><line x1="14" y1="29" x2="22" y2="29"/>',
    map:         '<path d="M8 12l10 3 12-4 10 3v22l-10-3-12 4-10-3z"/><line x1="18" y1="15" x2="18" y2="37"/><line x1="30" y1="11" x2="30" y2="33"/>',
    seeds:       '<ellipse cx="24" cy="30" rx="3" ry="7"/><ellipse cx="17" cy="34" rx="2" ry="5" transform="rotate(-20 17 34)"/><ellipse cx="31" cy="34" rx="2" ry="5" transform="rotate(20 31 34)"/>',
    recording:   '<rect x="8" y="16" width="32" height="18" rx="2"/><circle cx="17" cy="25" r="4"/><circle cx="31" cy="25" r="4"/><line x1="21" y1="25" x2="27" y2="25"/>',
    fragment:    '<path d="M10 12h18l8 12-8 12H10l6-12z"/><line x1="22" y1="16" x2="22" y2="22"/><circle cx="22" cy="26" r="1.5" fill="currentColor"/>',
    duplicate:   '<rect x="8" y="14" width="20" height="26" rx="1"/><rect x="18" y="8" width="20" height="26" rx="1" opacity="0.5"/>',
    personal:    '<circle cx="24" cy="14" r="6"/><path d="M10 42c0-8 6-14 14-14s14 6 14 14"/>',
    refuse:      '<circle cx="24" cy="24" r="14"/><line x1="14" y1="14" x2="34" y2="34"/>',
    origin:      '<circle cx="24" cy="10" r="4"/><line x1="24" y1="14" x2="24" y2="20"/><circle cx="14" cy="30" r="4"/><circle cx="34" cy="30" r="4"/><line x1="24" y1="20" x2="14" y2="26"/><line x1="24" y1="20" x2="34" y2="26"/>',
    type:        '<rect x="8" y="10" width="14" height="10" rx="1"/><rect x="26" y="10" width="14" height="10" rx="1"/><rect x="8" y="28" width="14" height="10" rx="1"/><rect x="26" y="28" width="14" height="10" rx="1"/>',
    fragility:   '<path d="M24 8l5 14H19z"/><path d="M16 34c0-6 4-8 8-8s8 2 8 8"/>',
    nosystem:    '<circle cx="14" cy="15" r="3"/><circle cx="34" cy="22" r="3"/><circle cx="18" cy="34" r="3"/><circle cx="30" cy="12" r="3"/>',
    'original-f':'<path d="M10 10h20l8 10v22H10z"/><line x1="30" y1="10" x2="30" y2="20"/><line x1="18" y1="22" x2="26" y2="22"/><line x1="18" y1="28" x2="26" y2="28"/>',
    reconstruct: '<path d="M12 38l6-28 6 16 6-16 6 28"/>',
    gap:         '<rect x="12" y="10" width="24" height="28" rx="1" stroke-dasharray="3 3"/>',
    bothver:     '<path d="M10 14h16v22H10z"/><path d="M18 10h16v22H18z"/>',
    book:        '<path d="M8 10h20c2 0 4 2 4 4v22H8z"/><line x1="28" y1="14" x2="28" y2="36"/><line x1="12" y1="18" x2="24" y2="18"/><line x1="12" y1="24" x2="24" y2="24"/><line x1="12" y1="30" x2="20" y2="30"/>',
    citymap:     '<rect x="8" y="8" width="32" height="32" rx="1"/><line x1="8" y1="22" x2="40" y2="22"/><line x1="22" y1="8" x2="22" y2="40"/><rect x="12" y="12" width="6" height="6"/><rect x="26" y="26" width="8" height="8"/>',
    word:        '<line x1="10" y1="14" x2="38" y2="14"/><line x1="10" y1="22" x2="30" y2="22"/><line x1="10" y1="30" x2="34" y2="30"/><line x1="16" y1="14" x2="16" y2="34"/>',
    nothing:     '<circle cx="24" cy="24" r="14"/><line x1="14" y1="14" x2="34" y2="34"/>',
    yourself:    '<circle cx="24" cy="24" r="14" opacity="0.35"/><circle cx="24" cy="18" r="5"/><path d="M14 38c0-6 4-10 10-10s10 4 10 10"/>',
    book2:       '<path d="M8 10h20c2 0 4 2 4 4v22H8z"/><line x1="28" y1="14" x2="28" y2="36"/>',
    lever:       '<line x1="24" y1="38" x2="28" y2="16"/><circle cx="28" cy="14" r="4"/><line x1="20" y1="38" x2="32" y2="38"/>',
    door:        '<rect x="12" y="8" width="24" height="36" rx="1"/><circle cx="32" cy="26" r="2" fill="currentColor"/>',
    toggle:      '<rect x="8" y="20" width="32" height="12" rx="6"/><circle cx="32" cy="26" r="5" fill="currentColor"/>',
    selfscan:    '<circle cx="24" cy="24" r="12" stroke-dasharray="4 3"/><circle cx="24" cy="20" r="4"/><path d="M16 36c0-5 4-8 8-8s8 3 8 8"/>',
    fire:        '<path d="M24 8c0 6-7 10-7 17a7 7 0 0014 0c0-3-1.2-5.5-3-7-0.5 3.5-3 5.5-4 5.5 0-5.5 3.5-9.5 3.5-15.5-1.5 1-3.5 0-3.5 0z"/>',
    lockicon:    '<rect x="10" y="22" width="28" height="20" rx="2"/><path d="M16 22v-5a8 8 0 0116 0v5"/><circle cx="24" cy="32" r="2.5" fill="currentColor" stroke="none"/>',
    redact:      '<rect x="6" y="19" width="36" height="10" rx="1" fill="currentColor" stroke="none" opacity="0.75"/><line x1="6" y1="14" x2="42" y2="14"/><line x1="6" y1="34" x2="38" y2="34"/><line x1="6" y1="39" x2="30" y2="39"/>',
    fwd:         '<line x1="9" y1="24" x2="37" y2="24"/><polyline points="29,16 37,24 29,32"/>',
    back:        '<line x1="39" y1="24" x2="11" y2="24"/><polyline points="19,16 11,24 19,32"/>',
    eyeopen:     '<path d="M6 24c6-10 30-10 36 0"/><path d="M6 24c6 10 30 10 36 0"/><circle cx="24" cy="24" r="5"/>',
    penbook:     '<path d="M8 12h22v28H8z"/><line x1="12" y1="20" x2="26" y2="20"/><line x1="12" y1="26" x2="22" y2="26"/><path d="M30 8l8 8-12 12-4 2 2-4z"/>',
    checkmark:   '<polyline points="9,26 20,36 41,14"/>',
    exitdoor:    '<path d="M24 10h14v28H24"/><line x1="8" y1="24" x2="30" y2="24"/><polyline points="22,16 30,24 22,32"/>'
  };

  function buildSvgIcon(type) {
    var s = svgEl('svg', {
      viewBox: '0 0 48 48',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    });
    s.innerHTML = SVG_ICONS[type] || SVG_ICONS['nothing'];
    return s;
  }


  /* ──────────────────────────────────────────────────────────
     SCENE BACKGROUND ILLUSTRATIONS
  ────────────────────────────────────────────────────────── */

  var SCENE_BGS = {
    'entrance': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 700" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="eLamp" cx="50%" cy="24%" r="52%"><stop offset="0%" stop-color="#c8883a" stop-opacity="0.45"/><stop offset="50%" stop-color="#b07828" stop-opacity="0.12"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient><radialGradient id="eVign" cx="50%" cy="42%" r="62%"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="#030504" stop-opacity="0.72"/></radialGradient><linearGradient id="eGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#030504" stop-opacity="0"/><stop offset="100%" stop-color="#020403" stop-opacity="0.85"/></linearGradient></defs><rect width="800" height="700" fill="#08090b"/><ellipse cx="400" cy="168" rx="385" ry="290" fill="url(#eLamp)"/><polygon points="0,700 800,700 575,418 225,418" fill="#0b0d09"/><line x1="227" y1="422" x2="573" y2="422" stroke="#18201a" stroke-width="1"/><line x1="240" y1="455" x2="560" y2="455" stroke="#16181a" stroke-width="0.8"/><line x1="260" y1="510" x2="540" y2="510" stroke="#14161a" stroke-width="0.8"/><line x1="290" y1="590" x2="510" y2="590" stroke="#12141a" stroke-width="0.8"/><rect x="0" y="65" width="192" height="640" fill="#0a0c09"/><rect x="0" y="65" width="192" height="4" fill="#181c14"/><rect x="0" y="162" width="192" height="3" fill="#151910"/><rect x="0" y="252" width="192" height="3" fill="#151910"/><rect x="0" y="338" width="192" height="3" fill="#141810"/><rect x="0" y="420" width="192" height="3" fill="#131710"/><rect x="0" y="500" width="192" height="3" fill="#131710"/><rect x="6" y="72" width="15" height="87" fill="#3d2e1e" rx="1"/><rect x="23" y="78" width="10" height="81" fill="#2e2318" rx="1"/><rect x="35" y="70" width="19" height="89" fill="#3a2a1a" rx="1"/><rect x="56" y="76" width="12" height="83" fill="#2a1e13" rx="1"/><rect x="70" y="73" width="14" height="86" fill="#362618" rx="1"/><rect x="86" y="77" width="9" height="82" fill="#2d2217" rx="1"/><rect x="97" y="71" width="17" height="88" fill="#3c2c1c" rx="1"/><rect x="116" y="75" width="11" height="84" fill="#2f2419" rx="1"/><rect x="129" y="72" width="13" height="87" fill="#33261a" rx="1"/><rect x="144" y="78" width="8" height="81" fill="#281e14" rx="1"/><rect x="154" y="70" width="15" height="89" fill="#382819" rx="1"/><rect x="171" y="74" width="14" height="85" fill="#2c2117" rx="1"/><rect x="5" y="167" width="18" height="82" fill="#2e2418" rx="1"/><rect x="25" y="170" width="12" height="79" fill="#3a2c1a" rx="1"/><rect x="39" y="165" width="16" height="84" fill="#31261a" rx="1"/><rect x="57" y="169" width="10" height="80" fill="#2b2017" rx="1"/><rect x="69" y="166" width="14" height="83" fill="#362818" rx="1"/><rect x="85" y="171" width="8" height="78" fill="#2d2318" rx="1"/><rect x="95" y="167" width="17" height="82" fill="#3b2b1c" rx="1"/><rect x="114" y="170" width="11" height="79" fill="#2e2218" rx="1"/><rect x="127" y="164" width="15" height="85" fill="#33261b" rx="1"/><rect x="144" y="169" width="9" height="80" fill="#2a1f15" rx="1"/><rect x="155" y="166" width="14" height="83" fill="#3a2a1b" rx="1"/><rect x="7" y="257" width="16" height="78" fill="#2f2519" rx="1"/><rect x="25" y="259" width="11" height="76" fill="#382918" rx="1"/><rect x="38" y="255" width="14" height="80" fill="#2c2017" rx="1"/><rect x="54" y="260" width="9" height="75" fill="#2e2419" rx="1"/><rect x="65" y="256" width="18" height="79" fill="#3c2d1d" rx="1"/><rect x="85" y="259" width="12" height="76" fill="#30251a" rx="1"/><rect x="608" y="65" width="192" height="640" fill="#0a0c09"/><rect x="608" y="65" width="192" height="4" fill="#181c14"/><rect x="608" y="162" width="192" height="3" fill="#151910"/><rect x="608" y="252" width="192" height="3" fill="#151910"/><rect x="608" y="338" width="192" height="3" fill="#141810"/><rect x="608" y="420" width="192" height="3" fill="#131710"/><rect x="608" y="500" width="192" height="3" fill="#131710"/><rect x="614" y="72" width="16" height="87" fill="#3d2e1e" rx="1"/><rect x="632" y="78" width="10" height="81" fill="#2e2318" rx="1"/><rect x="644" y="70" width="19" height="89" fill="#3a2a1a" rx="1"/><rect x="665" y="76" width="12" height="83" fill="#2a1e13" rx="1"/><rect x="679" y="73" width="14" height="86" fill="#362618" rx="1"/><rect x="695" y="77" width="9" height="82" fill="#2d2217" rx="1"/><rect x="706" y="71" width="17" height="88" fill="#3c2c1c" rx="1"/><rect x="725" y="75" width="11" height="84" fill="#2f2419" rx="1"/><rect x="738" y="72" width="13" height="87" fill="#33261a" rx="1"/><rect x="753" y="78" width="8" height="81" fill="#281e14" rx="1"/><rect x="763" y="70" width="15" height="89" fill="#382819" rx="1"/><rect x="780" y="74" width="14" height="85" fill="#2c2117" rx="1"/><rect x="612" y="167" width="18" height="82" fill="#2e2418" rx="1"/><rect x="632" y="170" width="12" height="79" fill="#3a2c1a" rx="1"/><rect x="646" y="165" width="16" height="84" fill="#31261a" rx="1"/><rect x="664" y="169" width="10" height="80" fill="#2b2017" rx="1"/><rect x="676" y="166" width="14" height="83" fill="#362818" rx="1"/><rect x="692" y="171" width="8" height="78" fill="#2d2318" rx="1"/><rect x="702" y="167" width="17" height="82" fill="#3b2b1c" rx="1"/><rect x="721" y="170" width="11" height="79" fill="#2e2218" rx="1"/><rect x="734" y="164" width="15" height="85" fill="#33261b" rx="1"/><rect x="751" y="169" width="9" height="80" fill="#2a1f15" rx="1"/><rect x="762" y="166" width="14" height="83" fill="#3a2a1b" rx="1"/><path d="M265,700 L265,275 Q400,115 535,275 L535,700" fill="none" stroke="#2a2618" stroke-width="3"/><path d="M280,700 L280,280 Q400,130 520,280 L520,700" fill="#060808" stroke="#1a1810" stroke-width="1"/><line x1="400" y1="0" x2="400" y2="88" stroke="#2e2820" stroke-width="1.5"/><ellipse cx="400" cy="18" rx="3" ry="6" fill="none" stroke="#3a3020" stroke-width="1.2"/><ellipse cx="400" cy="30" rx="6" ry="3" fill="none" stroke="#3a3020" stroke-width="1.2"/><ellipse cx="400" cy="42" rx="3" ry="6" fill="none" stroke="#3a3020" stroke-width="1.2"/><ellipse cx="400" cy="54" rx="6" ry="3" fill="none" stroke="#3a3020" stroke-width="1.2"/><ellipse cx="400" cy="66" rx="3" ry="6" fill="none" stroke="#3a3020" stroke-width="1.2"/><ellipse cx="400" cy="78" rx="6" ry="3" fill="none" stroke="#3a3020" stroke-width="1.2"/><polygon points="372,88 428,88 434,106 434,152 428,162 400,168 372,162 366,152 366,106" fill="#1c1808" stroke="#c89038" stroke-width="1.3"/><line x1="400" y1="88" x2="400" y2="168" stroke="#906828" stroke-width="0.8" opacity="0.5"/><line x1="366" y1="106" x2="434" y2="106" stroke="#906828" stroke-width="0.8" opacity="0.5"/><line x1="366" y1="152" x2="434" y2="152" stroke="#906828" stroke-width="0.8" opacity="0.5"/><ellipse cx="400" cy="130" rx="14" ry="22" fill="#c8883a" opacity="0.65"/><ellipse cx="400" cy="130" rx="6" ry="10" fill="#e8c870" opacity="0.82"/><path d="M0,0 Q18,62 8,118 Q-2,174 28,214 Q58,254 38,305 Q18,356 52,396" fill="none" stroke="#3d5c38" stroke-width="3" stroke-linecap="round"/><path d="M12,125 Q48,112 64,144" fill="none" stroke="#3d5c38" stroke-width="2" stroke-linecap="round"/><path d="M30,216 Q65,203 80,236" fill="none" stroke="#3d5c38" stroke-width="2" stroke-linecap="round"/><ellipse cx="10" cy="116" rx="17" ry="7" fill="#3d5c38" opacity="0.58" transform="rotate(-38 10 116)"/><ellipse cx="63" cy="142" rx="14" ry="6" fill="#456445" opacity="0.48" transform="rotate(18 63 142)"/><ellipse cx="29" cy="213" rx="19" ry="7" fill="#3d5c38" opacity="0.52" transform="rotate(-22 29 213)"/><ellipse cx="78" cy="233" rx="15" ry="6" fill="#456445" opacity="0.44" transform="rotate(26 78 233)"/><ellipse cx="38" cy="304" rx="17" ry="7" fill="#3d5c38" opacity="0.5" transform="rotate(-12 38 304)"/><path d="M800,0 Q782,58 792,114 Q802,170 772,210 Q742,250 762,301 Q782,352 748,392" fill="none" stroke="#3d5c38" stroke-width="3" stroke-linecap="round"/><ellipse cx="790" cy="113" rx="17" ry="7" fill="#3d5c38" opacity="0.55" transform="rotate(38 790 113)"/><ellipse cx="737" cy="138" rx="15" ry="6" fill="#456445" opacity="0.46" transform="rotate(-18 737 138)"/><ellipse cx="771" cy="208" rx="19" ry="7" fill="#3d5c38" opacity="0.5" transform="rotate(22 771 208)"/><ellipse cx="721" cy="228" rx="15" ry="6" fill="#456445" opacity="0.42" transform="rotate(-26 721 228)"/><rect width="800" height="700" fill="url(#eVign)"/><rect x="0" y="480" width="800" height="220" fill="url(#eGround)"/></svg>',
    'env-intake': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="dLamp" cx="35%" cy="0%" r="68%"><stop offset="0%" stop-color="#c8883a" stop-opacity="0.5"/><stop offset="45%" stop-color="#b07828" stop-opacity="0.15"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="dVign" cx="50%" cy="50%" r="62%"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="#030504" stop-opacity="0.7"/></radialGradient></defs><rect width="800" height="600" fill="#09090c"/><rect width="800" height="600" fill="url(#dLamp)"/><rect x="0" y="80" width="182" height="310" fill="#0c0e09"/><line x1="0" y1="140" x2="182" y2="140" stroke="#1a1e18" stroke-width="1"/><line x1="0" y1="200" x2="182" y2="200" stroke="#1a1e18" stroke-width="1"/><line x1="0" y1="260" x2="182" y2="260" stroke="#1a1e18" stroke-width="1"/><rect x="6" y="88" width="14" height="50" fill="#3a2818" rx="1"/><rect x="22" y="92" width="10" height="46" fill="#2c2018" rx="1"/><rect x="34" y="87" width="17" height="51" fill="#3c2c1c" rx="1"/><rect x="53" y="91" width="12" height="47" fill="#28201a" rx="1"/><rect x="67" y="88" width="13" height="50" fill="#342618" rx="1"/><rect x="82" y="93" width="9" height="45" fill="#2d2218" rx="1"/><rect x="93" y="88" width="16" height="50" fill="#3b2a1c" rx="1"/><rect x="111" y="91" width="11" height="47" fill="#2e2218" rx="1"/><rect x="124" y="89" width="14" height="49" fill="#33261a" rx="1"/><rect x="140" y="93" width="8" height="45" fill="#281e15" rx="1"/><rect x="150" y="88" width="14" height="50" fill="#382818" rx="1"/><rect x="6" y="148" width="16" height="50" fill="#2c2418" rx="1"/><rect x="24" y="151" width="12" height="47" fill="#382c1a" rx="1"/><rect x="38" y="147" width="15" height="51" fill="#30261a" rx="1"/><rect x="55" y="150" width="10" height="48" fill="#2a2018" rx="1"/><rect x="67" y="147" width="14" height="51" fill="#352718" rx="1"/><rect x="83" y="152" width="8" height="46" fill="#2d2218" rx="1"/><rect x="93" y="148" width="17" height="50" fill="#3a2a1c" rx="1"/><rect x="112" y="151" width="11" height="47" fill="#2e2218" rx="1"/><rect x="125" y="147" width="15" height="51" fill="#32261b" rx="1"/><rect x="142" y="151" width="9" height="47" fill="#2a1f15" rx="1"/><rect x="153" y="147" width="13" height="51" fill="#3a2a1b" rx="1"/><rect x="618" y="80" width="182" height="310" fill="#0c0e09"/><line x1="618" y1="140" x2="800" y2="140" stroke="#1a1e18" stroke-width="1"/><line x1="618" y1="200" x2="800" y2="200" stroke="#1a1e18" stroke-width="1"/><line x1="618" y1="260" x2="800" y2="260" stroke="#1a1e18" stroke-width="1"/><rect x="624" y="88" width="14" height="50" fill="#3a2818" rx="1"/><rect x="640" y="92" width="10" height="46" fill="#2c2018" rx="1"/><rect x="652" y="87" width="17" height="51" fill="#3c2c1c" rx="1"/><rect x="671" y="91" width="12" height="47" fill="#28201a" rx="1"/><rect x="685" y="88" width="13" height="50" fill="#342618" rx="1"/><rect x="700" y="93" width="9" height="45" fill="#2d2218" rx="1"/><rect x="711" y="88" width="16" height="50" fill="#3b2a1c" rx="1"/><rect x="729" y="91" width="11" height="47" fill="#2e2218" rx="1"/><rect x="742" y="89" width="14" height="49" fill="#33261a" rx="1"/><rect x="758" y="93" width="8" height="45" fill="#281e15" rx="1"/><rect x="768" y="88" width="14" height="50" fill="#382818" rx="1"/><rect x="624" y="148" width="16" height="50" fill="#2c2418" rx="1"/><rect x="642" y="151" width="12" height="47" fill="#382c1a" rx="1"/><rect x="656" y="147" width="15" height="51" fill="#30261a" rx="1"/><rect x="673" y="150" width="10" height="48" fill="#2a2018" rx="1"/><rect x="685" y="147" width="14" height="51" fill="#352718" rx="1"/><rect x="701" y="152" width="8" height="46" fill="#2d2218" rx="1"/><rect x="711" y="148" width="17" height="50" fill="#3a2a1c" rx="1"/><rect x="730" y="151" width="11" height="47" fill="#2e2218" rx="1"/><rect x="743" y="147" width="15" height="51" fill="#32261b" rx="1"/><rect x="760" y="151" width="9" height="47" fill="#2a1f15" rx="1"/><rect x="771" y="147" width="13" height="51" fill="#3a2a1b" rx="1"/><polygon points="60,600 740,600 680,308 120,308" fill="#28211a"/><polygon points="70,600 730,600 670,314 130,314" fill="#312a1e"/><line x1="132" y1="318" x2="668" y2="318" stroke="#c8903a" stroke-opacity="0.24" stroke-width="1.2"/><rect x="110" y="188" width="4" height="122" fill="#1e1a12"/><path d="M275,188 Q278,240 280,308" fill="none" stroke="#3a3228" stroke-width="24"/><path d="M275,188 Q278,240 280,308" fill="none" stroke="#44382a" stroke-width="2"/><rect x="255" y="180" width="52" height="9" fill="#2e2820" rx="4"/><ellipse cx="281" cy="176" rx="18" ry="11" fill="#3a3228"/><ellipse cx="281" cy="172" rx="14" ry="7" fill="#28221a"/><ellipse cx="340" cy="330" rx="200" ry="110" fill="#c8883a" opacity="0.12"/><rect x="400" y="330" width="75" height="38" fill="#c8b078" opacity="0.07" rx="1" transform="rotate(-2 400 330)"/><rect x="488" y="326" width="58" height="28" fill="#c8b078" opacity="0.05" rx="1" transform="rotate(3 488 326)"/><ellipse cx="590" cy="324" rx="36" ry="26" fill="#28201a" stroke="#4a3a28" stroke-width="1"/><ellipse cx="590" cy="322" rx="24" ry="17" fill="#201c14" stroke="#3a2e20" stroke-width="0.8"/><rect width="800" height="600" fill="url(#dVign)"/><rect x="0" y="450" width="800" height="150" fill="#030504" opacity="0.5"/></svg>',
    'env-memory': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 700" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="mDome" cx="50%" cy="0%" r="70%"><stop offset="0%" stop-color="#506845" stop-opacity="0.45"/><stop offset="55%" stop-color="#3d5835" stop-opacity="0.15"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="mJar" cx="50%" cy="60%" r="42%"><stop offset="0%" stop-color="#b88038" stop-opacity="0.28"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="mVign" cx="50%" cy="45%" r="65%"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="#020504" stop-opacity="0.75"/></radialGradient></defs><rect width="800" height="700" fill="#070a07"/><ellipse cx="400" cy="0" rx="460" ry="350" fill="url(#mDome)"/><path d="M400,0 L195,185" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.38"/><path d="M400,0 L278,205" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.38"/><path d="M400,0 L380,215" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.38"/><path d="M400,0 L420,215" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.38"/><path d="M400,0 L522,205" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.38"/><path d="M400,0 L605,185" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.38"/><path d="M0,205 Q200,185 400,0 Q600,185 800,205" fill="none" stroke="#3a5030" stroke-width="1.5" opacity="0.3"/><path d="M0,360 Q200,340 400,125 Q600,340 800,360" fill="none" stroke="#3a5030" stroke-width="1.2" opacity="0.2"/><path d="M0,0 Q-18,80 28,138 Q74,196 18,258 Q-28,320 38,382 Q88,432 28,495" fill="none" stroke="#4a6840" stroke-width="3.5" stroke-linecap="round"/><path d="M28,136 Q-18,108 -44,132" fill="none" stroke="#4a6840" stroke-width="2.2" stroke-linecap="round"/><path d="M20,256 Q-28,232 -52,258" fill="none" stroke="#4a6840" stroke-width="2.2" stroke-linecap="round"/><path d="M36,380 Q-8,355 -30,382" fill="none" stroke="#4a6840" stroke-width="2" stroke-linecap="round"/><ellipse cx="28" cy="134" rx="54" ry="21" fill="#3c6036" opacity="0.65" transform="rotate(-30 28 134)"/><ellipse cx="-25" cy="118" rx="40" ry="16" fill="#4a6e42" opacity="0.52" transform="rotate(-48 -25 118)"/><ellipse cx="18" cy="254" rx="58" ry="22" fill="#3c6036" opacity="0.58" transform="rotate(-20 18 254)"/><ellipse cx="-32" cy="244" rx="44" ry="18" fill="#4a6e42" opacity="0.5" transform="rotate(-42 -32 244)"/><ellipse cx="34" cy="378" rx="50" ry="20" fill="#3c6036" opacity="0.62" transform="rotate(-12 34 378)"/><ellipse cx="-12" cy="368" rx="38" ry="15" fill="#4a6e42" opacity="0.48" transform="rotate(-35 -12 368)"/><path d="M800,0 Q818,75 768,133 Q718,191 774,253 Q828,315 762,377 Q700,432 770,493" fill="none" stroke="#4a6840" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="770" cy="130" rx="54" ry="21" fill="#3c6036" opacity="0.62" transform="rotate(30 770 130)"/><ellipse cx="825" cy="114" rx="40" ry="16" fill="#4a6e42" opacity="0.5" transform="rotate(48 825 114)"/><ellipse cx="772" cy="250" rx="58" ry="22" fill="#3c6036" opacity="0.55" transform="rotate(20 772 250)"/><ellipse cx="830" cy="240" rx="44" ry="18" fill="#4a6e42" opacity="0.48" transform="rotate(42 830 240)"/><path d="M175,0 Q135,62 155,122 Q175,182 115,222 Q55,262 98,322" fill="none" stroke="#507545" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="153" cy="120" rx="46" ry="18" fill="#3c6036" opacity="0.52" transform="rotate(-26 153 120)"/><ellipse cx="108" cy="220" rx="50" ry="19" fill="#4a6e42" opacity="0.47" transform="rotate(-38 108 220)"/><path d="M625,0 Q665,58 645,118 Q625,178 685,218 Q745,258 702,318" fill="none" stroke="#507545" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="647" cy="116" rx="46" ry="18" fill="#3c6036" opacity="0.52" transform="rotate(26 647 116)"/><ellipse cx="692" cy="216" rx="50" ry="19" fill="#4a6e42" opacity="0.47" transform="rotate(38 692 216)"/><path d="M350,480 Q310,420 290,370 Q270,320 320,310" fill="none" stroke="#456040" stroke-width="2" stroke-linecap="round" opacity="0.6"/><ellipse cx="318" cy="312" rx="32" ry="12" fill="#3c6036" opacity="0.48" transform="rotate(-15 318 312)"/><path d="M450,490 Q490,425 510,375 Q530,325 480,315" fill="none" stroke="#456040" stroke-width="2" stroke-linecap="round" opacity="0.6"/><ellipse cx="482" cy="317" rx="32" ry="12" fill="#3c6036" opacity="0.48" transform="rotate(15 482 317)"/><rect x="158" y="462" width="484" height="14" fill="#28211a" rx="1"/><rect x="148" y="472" width="504" height="130" fill="#1e1812" rx="1"/><ellipse cx="252" cy="460" rx="42" ry="58" fill="#1a1610" stroke="#4a3a26" stroke-width="1"/><ellipse cx="252" cy="460" rx="34" ry="48" fill="#0e0b08" stroke="#3a2e1c" stroke-width="0.8"/><path d="M220,428 Q232,396 252,390 Q272,396 284,428" fill="#3e5a36" opacity="0.62"/><path d="M230,418 Q252,378 274,418" fill="#4a6840" opacity="0.52"/><ellipse cx="382" cy="450" rx="36" ry="52" fill="#1c1810" stroke="#4a3a26" stroke-width="1"/><path d="M360,420 Q382,384 404,420" fill="#3e5a36" opacity="0.58"/><ellipse cx="542" cy="458" rx="46" ry="62" fill="#1a1610" stroke="#4a3a26" stroke-width="1"/><ellipse cx="542" cy="458" rx="37" ry="52" fill="#0e0b08" stroke="#3a2e1c" stroke-width="0.8"/><path d="M506,424 Q520,388 542,382 Q564,388 578,424" fill="#3e5a36" opacity="0.6"/><path d="M516,414 Q542,374 568,414" fill="#4a6840" opacity="0.5"/><rect x="120" y="450" width="560" height="250" fill="url(#mJar)"/><rect width="800" height="700" fill="url(#mVign)"/></svg>',
    'env-terminal': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="tScreen" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#3a6040" stop-opacity="0.55"/><stop offset="70%" stop-color="#2a4a30" stop-opacity="0.2"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="tAmb" cx="50%" cy="85%" r="40%"><stop offset="0%" stop-color="#b87830" stop-opacity="0.22"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="tVign" cx="50%" cy="50%" r="58%"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="#020404" stop-opacity="0.68"/></radialGradient></defs><rect width="800" height="600" fill="#060808"/><rect x="0" y="360" width="800" height="12" fill="#181c14"/><rect x="0" y="368" width="800" height="232" fill="#131610"/><rect x="20" y="380" width="55" height="8" fill="#282c24" rx="1"/><rect x="20" y="396" width="42" height="8" fill="#282c24" rx="1"/><rect x="20" y="412" width="48" height="8" fill="#282c24" rx="1"/><rect x="725" y="380" width="55" height="8" fill="#282c24" rx="1"/><rect x="730" y="396" width="42" height="8" fill="#282c24" rx="1"/><rect x="220" y="110" width="360" height="258" rx="16" fill="#0e1210" stroke="#2a3028" stroke-width="3"/><rect x="228" y="118" width="344" height="242" rx="12" fill="#080c08"/><rect x="228" y="118" width="344" height="242" rx="12" fill="url(#tScreen)"/><text x="246" y="152" font-family="Courier New,monospace" font-size="12" fill="#4a9050" opacity="0.78">KEEPER TERMINAL</text><line x1="246" y1="162" x2="554" y2="162" stroke="#2a4a2a" stroke-width="0.8"/><text x="246" y="182" font-family="Courier New,monospace" font-size="11" fill="#3a7040" opacity="0.62">&gt; CATEGORY: INTANGIBLE</text><text x="246" y="200" font-family="Courier New,monospace" font-size="11" fill="#3a7040" opacity="0.55">&gt; NOT A NAME DATE OR PLACE</text><text x="246" y="220" font-family="Courier New,monospace" font-size="11" fill="#3a7040" opacity="0.48">&gt; THE THING IS REAL BUT</text><text x="246" y="240" font-family="Courier New,monospace" font-size="11" fill="#3a7040" opacity="0.48">&gt; CANNOT BE PHOTOGRAPHED</text><line x1="246" y1="252" x2="554" y2="252" stroke="#2a4a2a" stroke-width="0.8"/><text x="246" y="272" font-family="Courier New,monospace" font-size="11" fill="#5a9860" opacity="0.88">&gt; _</text><rect x="220" y="368" width="360" height="5" fill="#1a1e18"/><line x1="0" y1="488" x2="800" y2="488" stroke="#1c201a" stroke-width="2"/><rect x="0" y="480" width="800" height="6" fill="#3a2010" opacity="0.2"/><rect width="800" height="600" fill="url(#tVign)"/><rect width="800" height="600" fill="url(#tAmb)"/><path d="M0,0 Q14,48 4,98 Q-6,148 18,182" fill="none" stroke="#3a5030" stroke-width="2" stroke-linecap="round" opacity="0.7"/><ellipse cx="6" cy="96" rx="24" ry="10" fill="#3a5030" opacity="0.48" transform="rotate(-22 6 96)"/><ellipse cx="18" cy="180" rx="20" ry="8" fill="#3a5030" opacity="0.4" transform="rotate(18 18 180)"/><rect x="0" y="410" width="800" height="190" fill="#030504" opacity="0.55"/></svg>',
    'env-core': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 700" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="cMain" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#9ab0a0" stop-opacity="0.32"/><stop offset="48%" stop-color="#506858" stop-opacity="0.12"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="cBot" cx="50%" cy="92%" r="45%"><stop offset="0%" stop-color="#c8883a" stop-opacity="0.32"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="cVign" cx="50%" cy="45%" r="62%"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="#020403" stop-opacity="0.78"/></radialGradient></defs><rect width="800" height="700" fill="#07090a"/><ellipse cx="400" cy="350" rx="380" ry="285" fill="url(#cMain)"/><ellipse cx="400" cy="645" rx="325" ry="180" fill="url(#cBot)"/><rect x="0" y="0" width="95" height="700" fill="#09090b"/><rect x="705" y="0" width="95" height="700" fill="#09090b"/><line x1="95" y1="0" x2="95" y2="700" stroke="#181e1c" stroke-width="1"/><line x1="705" y1="0" x2="705" y2="700" stroke="#181e1c" stroke-width="1"/><line x1="95" y1="100" x2="705" y2="100" stroke="#181c18" stroke-width="0.8" opacity="0.4"/><line x1="95" y1="600" x2="705" y2="600" stroke="#181c18" stroke-width="0.8" opacity="0.4"/><polygon points="400,62 342,350 458,350" fill="none" stroke="#2a3830" stroke-width="1.5" opacity="0.48"/><circle cx="400" cy="350" r="145" fill="none" stroke="#2a3830" stroke-width="1.5" opacity="0.42"/><circle cx="400" cy="350" r="102" fill="none" stroke="#3a4840" stroke-width="1" opacity="0.38"/><circle cx="400" cy="350" r="62" fill="none" stroke="#4a5850" stroke-width="1" opacity="0.32"/><circle cx="400" cy="350" r="28" fill="none" stroke="#5a6860" stroke-width="0.8" opacity="0.28"/><line x1="400" y1="205" x2="400" y2="495" stroke="#2a3830" stroke-width="1" opacity="0.38"/><line x1="255" y1="350" x2="545" y2="350" stroke="#2a3830" stroke-width="1" opacity="0.38"/><line x1="298" y1="248" x2="502" y2="452" stroke="#2a3830" stroke-width="0.8" opacity="0.28"/><line x1="298" y1="452" x2="502" y2="248" stroke="#2a3830" stroke-width="0.8" opacity="0.28"/><circle cx="400" cy="350" r="24" fill="#181e1e" stroke="#5a7868" stroke-width="1.5"/><circle cx="400" cy="350" r="14" fill="#101a18" stroke="#4a6858" stroke-width="1.2"/><circle cx="400" cy="350" r="6" fill="#8ab0a0" opacity="0.55"/><rect x="382" y="58" width="36" height="292" fill="none" stroke="#2a3028" stroke-width="1" opacity="0.32"/><rect x="375" y="52" width="50" height="12" fill="#1c2220" rx="1"/><rect x="363" y="64" width="8" height="8" fill="#3a5040" rx="1"/><rect x="429" y="64" width="8" height="8" fill="#3a5040" rx="1"/><rect x="382" y="492" width="36" height="148" fill="none" stroke="#3a4028" stroke-width="1" opacity="0.32"/><rect x="375" y="638" width="50" height="12" fill="#1c2216" rx="1"/><rect x="363" y="628" width="8" height="8" fill="#7a5020" rx="1"/><rect x="429" y="628" width="8" height="8" fill="#7a5020" rx="1"/><line x1="255" y1="350" x2="115" y2="350" stroke="#2a3028" stroke-width="1" opacity="0.32"/><line x1="545" y1="350" x2="685" y2="350" stroke="#2a3028" stroke-width="1" opacity="0.32"/><rect x="98" y="341" width="18" height="18" fill="#1c2220" rx="1" stroke="#3a5040" stroke-width="1"/><rect x="684" y="341" width="18" height="18" fill="#1c2018" rx="1" stroke="#7a5020" stroke-width="1"/><rect width="800" height="700" fill="url(#cVign)"/></svg>',
    'default': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="rAmb" cx="50%" cy="0%" r="62%"><stop offset="0%" stop-color="#b87828" stop-opacity="0.38"/><stop offset="55%" stop-color="#9a6520" stop-opacity="0.1"/><stop offset="100%" stop-color="transparent"/></radialGradient><radialGradient id="rVign" cx="50%" cy="45%" r="62%"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="#030504" stop-opacity="0.72"/></radialGradient></defs><rect width="800" height="600" fill="#09090c"/><rect width="800" height="600" fill="url(#rAmb)"/><rect x="0" y="50" width="162" height="500" fill="#0c0e0a"/><line x1="0" y1="115" x2="162" y2="115" stroke="#1c1e18" stroke-width="1"/><line x1="0" y1="185" x2="162" y2="185" stroke="#1c1e18" stroke-width="1"/><line x1="0" y1="255" x2="162" y2="255" stroke="#1c1e18" stroke-width="1"/><line x1="0" y1="325" x2="162" y2="325" stroke="#1c1e18" stroke-width="1"/><line x1="0" y1="395" x2="162" y2="395" stroke="#1c1e18" stroke-width="1"/><rect x="5" y="58" width="13" height="55" fill="#362818" rx="1"/><rect x="20" y="62" width="9" height="51" fill="#2c2018" rx="1"/><rect x="31" y="57" width="15" height="56" fill="#3c2c1c" rx="1"/><rect x="48" y="61" width="11" height="52" fill="#28201a" rx="1"/><rect x="61" y="58" width="13" height="55" fill="#342618" rx="1"/><rect x="76" y="62" width="8" height="51" fill="#2d2218" rx="1"/><rect x="86" y="57" width="14" height="56" fill="#3b2a1c" rx="1"/><rect x="102" y="61" width="10" height="52" fill="#2e2218" rx="1"/><rect x="114" y="59" width="12" height="54" fill="#33261a" rx="1"/><rect x="128" y="63" width="7" height="50" fill="#281e15" rx="1"/><rect x="137" y="58" width="12" height="55" fill="#382818" rx="1"/><rect x="5" y="122" width="15" height="61" fill="#2c2418" rx="1"/><rect x="22" y="125" width="10" height="58" fill="#382c1a" rx="1"/><rect x="34" y="121" width="14" height="62" fill="#30261a" rx="1"/><rect x="50" y="124" width="9" height="59" fill="#2a2018" rx="1"/><rect x="61" y="121" width="13" height="62" fill="#352718" rx="1"/><rect x="76" y="126" width="7" height="57" fill="#2d2218" rx="1"/><rect x="85" y="121" width="15" height="62" fill="#3a2a1c" rx="1"/><rect x="102" y="124" width="10" height="59" fill="#2e2218" rx="1"/><rect x="114" y="121" width="13" height="62" fill="#32261b" rx="1"/><rect x="129" y="125" width="8" height="58" fill="#2a1f15" rx="1"/><rect x="139" y="121" width="12" height="62" fill="#3a2a1b" rx="1"/><rect x="638" y="50" width="162" height="500" fill="#0c0e0a"/><line x1="638" y1="115" x2="800" y2="115" stroke="#1c1e18" stroke-width="1"/><line x1="638" y1="185" x2="800" y2="185" stroke="#1c1e18" stroke-width="1"/><line x1="638" y1="255" x2="800" y2="255" stroke="#1c1e18" stroke-width="1"/><line x1="638" y1="325" x2="800" y2="325" stroke="#1c1e18" stroke-width="1"/><line x1="638" y1="395" x2="800" y2="395" stroke="#1c1e18" stroke-width="1"/><rect x="643" y="58" width="13" height="55" fill="#362818" rx="1"/><rect x="658" y="62" width="9" height="51" fill="#2c2018" rx="1"/><rect x="669" y="57" width="15" height="56" fill="#3c2c1c" rx="1"/><rect x="686" y="61" width="11" height="52" fill="#28201a" rx="1"/><rect x="699" y="58" width="13" height="55" fill="#342618" rx="1"/><rect x="714" y="62" width="8" height="51" fill="#2d2218" rx="1"/><rect x="724" y="57" width="14" height="56" fill="#3b2a1c" rx="1"/><rect x="740" y="61" width="10" height="52" fill="#2e2218" rx="1"/><rect x="752" y="59" width="12" height="54" fill="#33261a" rx="1"/><rect x="766" y="63" width="7" height="50" fill="#281e15" rx="1"/><rect x="775" y="58" width="12" height="55" fill="#382818" rx="1"/><rect x="643" y="122" width="15" height="61" fill="#2c2418" rx="1"/><rect x="660" y="125" width="10" height="58" fill="#382c1a" rx="1"/><rect x="672" y="121" width="14" height="62" fill="#30261a" rx="1"/><rect x="688" y="124" width="9" height="59" fill="#2a2018" rx="1"/><rect x="699" y="121" width="13" height="62" fill="#352718" rx="1"/><rect x="714" y="126" width="7" height="57" fill="#2d2218" rx="1"/><rect x="723" y="121" width="15" height="62" fill="#3a2a1c" rx="1"/><rect x="740" y="124" width="10" height="59" fill="#2e2218" rx="1"/><rect x="752" y="121" width="13" height="62" fill="#32261b" rx="1"/><rect x="767" y="125" width="8" height="58" fill="#2a1f15" rx="1"/><rect x="777" y="121" width="12" height="62" fill="#3a2a1b" rx="1"/><rect x="280" y="0" width="240" height="7" fill="#2a2820"/><rect x="290" y="5" width="220" height="3" fill="#b8883a" opacity="0.3"/><rect x="0" y="470" width="800" height="130" fill="#030504" opacity="0.65"/><rect width="800" height="600" fill="url(#rVign)"/></svg>'
  };

  function renderSceneBg(container, env) {
    var bg = el('div', { className: 'arc-scene-bg' });
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = SCENE_BGS[env] || SCENE_BGS['default'];
    container.appendChild(bg);
  }

  /* ──────────────────────────────────────────────────────────
     ENTRANCE SCENE
  ────────────────────────────────────────────────────────── */

  function renderEntranceScene(root) {
    var li = state.lang === 'zh' ? 1 : 0;
    var div = el('div', { className: 'arc-entrance' });

    // Atmospheric background illustration (archival lobby corridor)
    var entBg = el('div', { className: 'arc-entrance-bg' });
    entBg.setAttribute('aria-hidden', 'true');
    entBg.innerHTML = SCENE_BGS['entrance'];
    div.appendChild(entBg);

    var inner = el('div', { className: 'arc-entrance-inner' });

    // ── Architectural panel: the building's mounted identity plate
    var panel = el('div', { className: 'arc-entrance-panel' });

    var inst = el('div', { className: 'arc-entrance-institute' });
    inst.textContent = 'BOTANICAL MEMORY RESEARCH INSTITUTE';
    panel.appendChild(inst);

    var instSub = el('div', { className: 'arc-entrance-institute-sub' });
    instSub.textContent = 'DEPT. OF COGNITIVE BOTANY  ·  EST. 1971';
    panel.appendChild(instSub);

    var panelRule = el('div', { className: 'arc-entrance-panel-rule' });
    panel.appendChild(panelRule);

    var opLabel = el('div', { className: 'arc-entrance-op-label' });
    opLabel.textContent = li === 1 ? '当前任务' : 'CURRENT OPERATION';
    panel.appendChild(opLabel);

    var titleBlock = el('div', { className: 'arc-entrance-title' });
    var titleEn = el('span', { className: 'arc-entrance-title-en' });
    titleEn.textContent = 'THE LAST ARCHIVE';
    titleBlock.appendChild(titleEn);
    var titleZh = el('span', { className: 'arc-entrance-title-zh' });
    titleZh.textContent = '最后的档案馆';
    titleBlock.appendChild(titleZh);
    panel.appendChild(titleBlock);

    inner.appendChild(panel);

    var divider = el('div', { className: 'arc-entrance-divider' });
    inner.appendChild(divider);

    var subtitle = el('p', { className: 'arc-entrance-subtitle' });
    subtitle.textContent = li === 1
      ? '世界正在逐渐忘记自己。所有曾被记录的，正在消散。你已被任命为最后的保管者。'
      : 'The institute has been sealed. Everything once recorded is dissolving. You have been appointed its last keeper.';
    inner.appendChild(subtitle);

    var btn = el('button', { className: 'arc-enter-btn' });
    btn.setAttribute('type', 'button');
    btn.textContent = li === 1
      ? '接受指派  —  进入设施'
      : 'ACCEPT APPOINTMENT — ENTER FACILITY';
    btn.addEventListener('click', function () { goToStep(0); });
    inner.appendChild(btn);

    var meta = el('div', { className: 'arc-entrance-meta' });
    meta.textContent = li === 1
      ? '12 个决定  ·  4 幕  ·  约 10 分钟'
      : '12 DECISIONS  ·  4 ACTS  ·  ~10 MIN';
    inner.appendChild(meta);

    div.appendChild(inner);
    root.appendChild(div);
  }

  /* ──────────────────────────────────────────────────────────
     OBJECT SCENE (Q0, Q9)
  ────────────────────────────────────────────────────────── */

  var OBJ_CONFIG = {
    0: [
      { icon: 'diary',     pos: ['6%',  '28%'] },
      { icon: 'map',       pos: ['52%', '20%'] },
      { icon: 'seeds',     pos: ['8%',  '52%'] },
      { icon: 'recording', pos: ['55%', '48%'] }
    ],
    9: [
      { icon: 'fragment',  pos: ['8%',  '22%'] },
      { icon: 'duplicate', pos: ['54%', '16%'] },
      { icon: 'personal',  pos: ['10%', '50%'] },
      { icon: 'refuse',    pos: ['57%', '46%'] }
    ]
  };

  function renderObjectScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var cfg = OBJ_CONFIG[qIdx] || OBJ_CONFIG[0];
    var li = state.lang === 'zh' ? 1 : 0;

    var stage = el('div', { className: 'arc-obj-stage' });

    for (var oi = 0; oi < q.options.length; oi++) {
      (function (opt, icfg) {
        var label = li === 1 ? opt.zh : opt.en;
        var btn = el('button', { className: 'arc-obj', style: { left: icfg.pos[0], top: icfg.pos[1] } });
        btn.setAttribute('aria-label', label);
        btn.setAttribute('type', 'button');

        var keySpan = el('span', { className: 'arc-obj-key' });
        keySpan.textContent = opt.value;
        btn.appendChild(keySpan);

        var icon = buildSvgIcon(icfg.icon);
        icon.setAttribute('aria-hidden', 'true');
        btn.appendChild(icon);

        var lbl = el('span', { className: 'arc-obj-label' });
        lbl.textContent = label.length > 40 ? label.slice(0, 38) + '…' : label;
        btn.appendChild(lbl);

        btn.addEventListener('click', function () {
          var siblings = stage.querySelectorAll('.arc-obj');
          for (var si = 0; si < siblings.length; si++) {
            siblings[si].classList.add('arc-obj--faded');
            siblings[si].disabled = true;
          }
          btn.classList.remove('arc-obj--faded');
          btn.classList.add('arc-obj--selected');

          state.answers[qIdx] = opt.value;
          saveState();

          setTimeout(function () {
            var msg = getConsequenceMsg(qIdx, opt.value);
            showConsequence(msg, function () { advanceStep(qIdx); });
          }, 360);
        });

        stage.appendChild(btn);
      }(q.options[oi], cfg[oi] || { icon: 'nothing', pos: ['50%', '50%'] }));
    }

    container.appendChild(stage);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    var textP = el('p', { className: 'arc-narrative-text' });
    textP.textContent = li === 1 ? q.zh.text : q.en.text;
    narrative.appendChild(textP);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     BINARY SCENE (Q1, Q7)
  ────────────────────────────────────────────────────────── */

  var BINARY_ICONS = {
    1: ['origin', 'type', 'fragility', 'nosystem'],
    7: ['original-f', 'reconstruct', 'gap', 'bothver']
  };

  function renderBinaryScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;
    var icons = BINARY_ICONS[qIdx] || ['nothing', 'nothing', 'nothing', 'nothing'];

    var grid = el('div', { className: 'arc-binary-grid' });

    for (var bi = 0; bi < q.options.length; bi++) {
      (function (opt, iconType) {
        var label = li === 1 ? opt.zh : opt.en;
        var btn = el('button', { className: 'arc-binary-zone' });
        btn.setAttribute('aria-label', label);
        btn.setAttribute('type', 'button');

        var key = el('span', { className: 'arc-binary-key' });
        key.textContent = opt.value;
        btn.appendChild(key);

        var icon = buildSvgIcon(iconType);
        icon.classList.add('arc-binary-icon');
        icon.setAttribute('aria-hidden', 'true');
        btn.appendChild(icon);

        var lbl = el('span', { className: 'arc-binary-label' });
        lbl.textContent = label;
        btn.appendChild(lbl);

        btn.addEventListener('click', function () {
          var all = grid.querySelectorAll('.arc-binary-zone');
          for (var ai = 0; ai < all.length; ai++) {
            all[ai].classList.add('arc-binary-zone--faded');
            all[ai].disabled = true;
          }
          btn.classList.remove('arc-binary-zone--faded');
          btn.classList.add('arc-binary-zone--selected');

          state.answers[qIdx] = opt.value;
          saveState();

          setTimeout(function () {
            var msg = getConsequenceMsg(qIdx, opt.value);
            showConsequence(msg, function () { advanceStep(qIdx); });
          }, 280);
        });

        grid.appendChild(btn);
      }(q.options[bi], icons[bi] || 'nothing'));
    }

    container.appendChild(grid);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    var textP = el('p', { className: 'arc-narrative-text' });
    textP.textContent = li === 1 ? q.zh.text : q.en.text;
    narrative.appendChild(textP);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     DOCUMENT SCENE (Q2, Q3, Q6)
  ────────────────────────────────────────────────────────── */

  var DOC_META = {
    2: {
      code: 'DOC-0041', hdr: ['CLAIM — PERSONAL PROVENANCE', '申诉 — 个人归属'],
      stamps: [
        { icon: 'back',      zh: '归还',    en: 'RETURN'  },
        { icon: 'lockicon',  zh: '封存待核', en: 'SEAL'    },
        { icon: 'eyeopen',   zh: '开放查阅', en: 'DISCLOSE'},
        { icon: 'penbook',   zh: '共同注解', en: 'ANNOTATE'}
      ]
    },
    3: {
      code: 'DOC-0042', hdr: ['EVIDENCE JOURNAL — RESTRICTED', '证据日记 — 受限'],
      stamps: [
        { icon: 'fire',      zh: '销毁',    en: 'DESTROY' },
        { icon: 'lockicon',  zh: '封存百年', en: 'SEAL·100Y'},
        { icon: 'redact',    zh: '涂黑',    en: 'REDACT'  },
        { icon: 'fwd',       zh: '留给下一任',en: 'DEFER'  }
      ]
    },
    6: {
      code: 'REC-0023', hdr: ['AUDIO TRANSFER — EFFECT REPORT', '音频转移 — 影响报告'],
      stamps: [
        { icon: 'checkmark', zh: '留存',    en: 'KEEP'    },
        { icon: 'exitdoor',  zh: '带走',    en: 'REMOVE'  },
        { icon: 'lockicon',  zh: '封存',    en: 'SEAL'    },
        { icon: 'fire',      zh: '销毁',    en: 'DESTROY' }
      ]
    }
  };

  function renderDocumentScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;
    var meta = DOC_META[qIdx] || { code: 'DOC-0000', hdr: ['DOCUMENT', '文件'] };

    var stage = el('div', { className: 'arc-doc-stage' });

    var doc = el('div', { className: 'arc-document' });
    doc.setAttribute('data-code', meta.code);

    var docHdr = el('div', { className: 'arc-doc-header' });
    docHdr.textContent = meta.hdr[li];
    doc.appendChild(docHdr);

    var docBody = el('div', { className: 'arc-doc-body' });
    docBody.textContent = li === 1 ? q.zh.text : q.en.text;
    doc.appendChild(docBody);

    stage.appendChild(doc);

    var stampsRow = el('div', { className: 'arc-stamps-row' });
    stampsRow.setAttribute('role', 'group');
    stampsRow.setAttribute('aria-label', li === 1 ? '选择操作' : 'Choose an action');

    for (var si = 0; si < q.options.length; si++) {
      (function (opt, stampCfg) {
        var label = li === 1 ? opt.zh : opt.en;
        var btn = el('button', { className: 'arc-stamp' });
        btn.setAttribute('aria-label', label);
        btn.setAttribute('type', 'button');

        if (stampCfg) {
          var sIcon = buildSvgIcon(stampCfg.icon);
          sIcon.classList.add('arc-stamp-icon');
          sIcon.setAttribute('aria-hidden', 'true');
          btn.appendChild(sIcon);
          var sName = el('span', { className: 'arc-stamp-name' });
          sName.textContent = li === 1 ? stampCfg.zh : stampCfg.en;
          btn.appendChild(sName);
          var sSub = el('span', { className: 'arc-stamp-sub' });
          sSub.textContent = li === 1 ? stampCfg.en : label.split('.')[0];
          btn.appendChild(sSub);
        } else {
          var shortLabel = label.length > 30 ? label.slice(0, 28) + '…' : label;
          btn.textContent = opt.value + ' ' + shortLabel;
        }

        btn.addEventListener('click', function () {
          btn.classList.add('arc-stamp--pressed');
          var all = stampsRow.querySelectorAll('.arc-stamp');
          for (var ai = 0; ai < all.length; ai++) all[ai].disabled = true;

          state.answers[qIdx] = opt.value;
          saveState();

          setTimeout(function () {
            var msg = getConsequenceMsg(qIdx, opt.value);
            showConsequence(msg, function () { advanceStep(qIdx); });
          }, 380);
        });

        stampsRow.appendChild(btn);
      }(q.options[si], meta.stamps ? meta.stamps[si] : null));
    }

    stage.appendChild(stampsRow);
    container.appendChild(stage);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     SHELF SCENE (Q4 — ranking)
  ────────────────────────────────────────────────────────── */

  function renderShelfScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;

    var savedRank = state.rankingState;
    var order = (Array.isArray(savedRank) && savedRank.length === 4)
      ? savedRank.slice()
      : defaultRankingOrder();

    var itemMap = {};
    q.items.forEach(function (item) { itemMap[item.id] = li === 1 ? item.zh : item.en; });

    var rankLabels = [
      ['优先 1', 'PRIORITY 1'],
      ['优先 2', 'PRIORITY 2'],
      ['优先 3', 'PRIORITY 3'],
      ['优先 4', 'PRIORITY 4']
    ];

    var shelfWrap = el('div', { className: 'arc-shelf-scene' });
    var tierEls = [];

    function refreshTiers() {
      for (var ti = 0; ti < 4; ti++) {
        var tier = tierEls[ti];
        // Remove old item + arrows, keep rank label
        var old = tier.querySelectorAll('.arc-shelf-item, .arc-shelf-arrows');
        for (var oi = 0; oi < old.length; oi++) tier.removeChild(old[oi]);

        var itemEl = el('div', { className: 'arc-shelf-item' });
        itemEl.setAttribute('draggable', 'true');
        itemEl.setAttribute('data-idx', '' + ti);
        itemEl.setAttribute('tabIndex', '0');
        itemEl.setAttribute('aria-label', itemMap[order[ti]]);
        itemEl.textContent = itemMap[order[ti]];
        tier.classList.add('arc-shelf-tier--occupied');

        var arrows = el('div', { className: 'arc-shelf-arrows' });
        var upBtn = el('button', { className: 'arc-shelf-arrow' });
        upBtn.setAttribute('aria-label', li === 1 ? '上移' : 'Move up');
        upBtn.setAttribute('type', 'button');
        upBtn.textContent = '↑';
        if (ti === 0) upBtn.disabled = true;

        var dnBtn = el('button', { className: 'arc-shelf-arrow' });
        dnBtn.setAttribute('aria-label', li === 1 ? '下移' : 'Move down');
        dnBtn.setAttribute('type', 'button');
        dnBtn.textContent = '↓';
        if (ti === 3) dnBtn.disabled = true;

        (function (idx) {
          upBtn.addEventListener('click', function () {
            if (idx > 0) {
              var tmp = order[idx]; order[idx] = order[idx - 1]; order[idx - 1] = tmp;
              refreshTiers();
            }
          });
          dnBtn.addEventListener('click', function () {
            if (idx < 3) {
              var tmp = order[idx]; order[idx] = order[idx + 1]; order[idx + 1] = tmp;
              refreshTiers();
            }
          });
        }(ti));

        arrows.appendChild(upBtn);
        arrows.appendChild(dnBtn);
        tier.appendChild(itemEl);
        tier.appendChild(arrows);
      }
      setupShelfDrag();
    }

    function setupShelfDrag() {
      var items = shelfWrap.querySelectorAll('.arc-shelf-item');
      var fromIdx = null;

      items.forEach(function (item) {
        item.addEventListener('dragstart', function () {
          fromIdx = parseInt(item.getAttribute('data-idx'), 10);
          item.classList.add('arc-shelf-dragging');
        });
        item.addEventListener('dragend', function () {
          item.classList.remove('arc-shelf-dragging');
          var allTiers = shelfWrap.querySelectorAll('.arc-shelf-tier');
          for (var ai = 0; ai < allTiers.length; ai++) {
            allTiers[ai].classList.remove('arc-shelf-over');
          }
        });
      });

      for (var di = 0; di < 4; di++) {
        (function (tier, idx) {
          tier.addEventListener('dragover', function (e) {
            e.preventDefault();
            tier.classList.add('arc-shelf-over');
          });
          tier.addEventListener('dragleave', function () {
            tier.classList.remove('arc-shelf-over');
          });
          tier.addEventListener('drop', function (e) {
            e.preventDefault();
            tier.classList.remove('arc-shelf-over');
            if (fromIdx !== null && fromIdx !== idx) {
              var tmp = order[fromIdx]; order[fromIdx] = order[idx]; order[idx] = tmp;
              fromIdx = null;
              refreshTiers();
            }
          });
        }(tierEls[di], di));
      }
    }

    for (var ti = 0; ti < 4; ti++) {
      var tier = el('div', { className: 'arc-shelf-tier' });
      tier.setAttribute('data-pos', '' + ti);
      var rankLabel = el('div', { className: 'arc-shelf-tier-rank' });
      rankLabel.textContent = rankLabels[ti][li === 1 ? 0 : 1];
      tier.appendChild(rankLabel);
      tierEls.push(tier);
      shelfWrap.appendChild(tier);
    }

    refreshTiers();

    var confirmBtn = el('button', { className: 'arc-shelf-confirm arc-shelf-confirm--visible' });
    confirmBtn.setAttribute('type', 'button');
    confirmBtn.textContent = li === 1 ? '确认排序' : 'CONFIRM ARRANGEMENT';
    confirmBtn.addEventListener('click', function () {
      state.answers[qIdx] = order.slice();
      state.rankingState = order.slice();
      saveState();
      var msg = li === 1 ? '迁移清单已更新。' : 'Relocation manifest updated.';
      showConsequence(msg, function () { advanceStep(qIdx); });
    });
    shelfWrap.appendChild(confirmBtn);
    container.appendChild(shelfWrap);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    var textP = el('p', { className: 'arc-narrative-text' });
    textP.textContent = li === 1 ? q.zh.text : q.en.text;
    narrative.appendChild(textP);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     STORAGE SCENE (Q5 — allocation)
  ────────────────────────────────────────────────────────── */

  function renderStorageScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;
    var MAX_CELLS = 10;
    var CELL_VAL  = 10;

    var alloc = {};
    q.categories.forEach(function (c) {
      var saved = state.allocationState && state.allocationState[c.id];
      alloc[c.id] = saved != null ? Math.round(saved / CELL_VAL) : 0;
    });

    var scene = el('div', { className: 'arc-storage-scene' });
    var catEls = {};
    var remainingEl;
    var confirmBtn;

    function totalCells() {
      return q.categories.reduce(function (s, c) { return s + alloc[c.id]; }, 0);
    }

    function refreshCat(catId) {
      var cells = catEls[catId].cells;
      var n = alloc[catId];
      for (var ci = 0; ci < cells.length; ci++) {
        if (ci < n) { cells[ci].classList.add('arc-storage-cell--filled'); }
        else { cells[ci].classList.remove('arc-storage-cell--filled'); }
      }
      catEls[catId].countEl.textContent = '' + n;
    }

    function refreshRemaining() {
      var rem = MAX_CELLS - totalCells();
      if (remainingEl) {
        var label = li === 1 ? '未分配：' : 'UNALLOCATED: ';
        remainingEl.innerHTML = label + '<em>' + rem + '</em>';
      }
      if (confirmBtn) {
        if (totalCells() > 0) {
          confirmBtn.classList.add('arc-storage-confirm--ready');
        } else {
          confirmBtn.classList.remove('arc-storage-confirm--ready');
        }
      }
    }

    q.categories.forEach(function (cat) {
      var div = el('div', { className: 'arc-storage-category' });
      var hdr = el('div', { className: 'arc-storage-header' });
      var nameEl = el('span', { className: 'arc-storage-name' });
      nameEl.textContent = li === 1 ? cat.zh : cat.en;
      var countEl = el('span', { className: 'arc-storage-count' });
      countEl.textContent = '' + alloc[cat.id];
      hdr.appendChild(nameEl);
      hdr.appendChild(countEl);
      div.appendChild(hdr);

      var cellsDiv = el('div', { className: 'arc-storage-cells' });
      cellsDiv.setAttribute('aria-hidden', 'true');
      var cells = [];
      for (var ci2 = 0; ci2 < MAX_CELLS; ci2++) {
        var cell = el('div', { className: 'arc-storage-cell' + (ci2 < alloc[cat.id] ? ' arc-storage-cell--filled' : '') });
        cellsDiv.appendChild(cell);
        cells.push(cell);
      }
      div.appendChild(cellsDiv);

      catEls[cat.id] = { cells: cells, countEl: countEl };

      var controls = el('div', { className: 'arc-storage-controls' });
      var minusBtn = el('button', { className: 'arc-storage-btn' });
      minusBtn.setAttribute('aria-label', li === 1 ? '减少' : 'Decrease');
      minusBtn.setAttribute('type', 'button');
      minusBtn.textContent = '−';
      var plusBtn = el('button', { className: 'arc-storage-btn' });
      plusBtn.setAttribute('aria-label', li === 1 ? '增加' : 'Increase');
      plusBtn.setAttribute('type', 'button');
      plusBtn.textContent = '+';

      (function (catId) {
        minusBtn.addEventListener('click', function () {
          if (alloc[catId] > 0) { alloc[catId]--; refreshCat(catId); refreshRemaining(); }
        });
        plusBtn.addEventListener('click', function () {
          if (totalCells() < MAX_CELLS) { alloc[catId]++; refreshCat(catId); refreshRemaining(); }
        });
      }(cat.id));

      controls.appendChild(minusBtn);
      controls.appendChild(plusBtn);
      div.appendChild(controls);
      scene.appendChild(div);
    });

    remainingEl = el('div', { className: 'arc-storage-remaining' });
    scene.appendChild(remainingEl);
    refreshRemaining();

    confirmBtn = el('button', { className: 'arc-storage-confirm' });
    confirmBtn.setAttribute('type', 'button');
    confirmBtn.textContent = li === 1 ? '封存分配' : 'SEAL ALLOCATION';
    confirmBtn.addEventListener('click', function () {
      var result = {};
      q.categories.forEach(function (c) { result[c.id] = alloc[c.id] * CELL_VAL; });
      state.answers[qIdx] = result;
      state.allocationState = result;
      saveState();
      var msg = li === 1 ? '分配已封存。' : 'Allocation sealed.';
      showConsequence(msg, function () { advanceStep(qIdx); });
    });
    scene.appendChild(confirmBtn);
    container.appendChild(scene);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    var textP = el('p', { className: 'arc-narrative-text' });
    textP.textContent = li === 1 ? q.zh.text : q.en.text;
    narrative.appendChild(textP);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     TERMINAL SCENE (Q8 — word input)
  ────────────────────────────────────────────────────────── */

  function renderTerminalScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;

    var wrap = el('div', { className: 'arc-terminal-wrap' });
    var frame = el('div', { className: 'arc-terminal-frame' });
    var body = el('div', { className: 'arc-terminal-body' });

    var termLines = li === 1 ? [
      'KEEPER TERMINAL — 区域 09',
      '> 请求登记条目',
      '> 类别：非物质类',
      '> 限制：不得为姓名、日期或地名'
    ] : [
      'KEEPER TERMINAL — SECTOR 09',
      '> REGISTER ENTRY REQUESTED',
      '> CATEGORY: INTANGIBLE',
      '> CONSTRAINT: NOT A NAME, DATE, OR PLACE'
    ];

    for (var tli = 0; tli < termLines.length; tli++) {
      var ln = el('div', { className: 'arc-terminal-line' + (tli === termLines.length - 1 ? ' arc-terminal-line--active' : '') });
      ln.textContent = termLines[tli];
      body.appendChild(ln);
    }

    var sep = el('hr', { className: 'arc-terminal-sep' });
    body.appendChild(sep);

    var inputRow = el('div', { className: 'arc-terminal-input-row' });
    var prompt = el('span', { className: 'arc-terminal-prompt' });
    prompt.textContent = '>';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'arc-terminal-input';
    input.placeholder = li === 1 ? q.zh.placeholder : q.en.placeholder;
    input.maxLength = 32;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', li === 1 ? q.zh.note : q.en.note);
    input.value = state.wordInput || '';

    var submitBtn = el('button', { className: 'arc-terminal-submit' });
    submitBtn.setAttribute('type', 'button');
    submitBtn.textContent = li === 1 ? '登记' : 'LOG';

    function doSubmit() {
      var word = input.value.trim();
      state.wordInput = word;
      state.answers[qIdx] = word || '';
      saveState();
      var msg = word
        ? (li === 1 ? ('“' + word + '” 已登记。') : '"' + word + '" has been registered.')
        : (li === 1 ? '条目留空。' : 'Entry left blank.');
      showConsequence(msg, function () { advanceStep(qIdx); });
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSubmit(); }
    });
    submitBtn.addEventListener('click', doSubmit);

    inputRow.appendChild(prompt);
    inputRow.appendChild(input);
    inputRow.appendChild(submitBtn);
    body.appendChild(inputRow);
    frame.appendChild(body);
    wrap.appendChild(frame);
    container.appendChild(wrap);

    setTimeout(function () { input.focus(); }, 100);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    var noteP = el('p', { className: 'arc-narrative-text' });
    noteP.textContent = li === 1 ? q.zh.note : q.en.note;
    narrative.appendChild(noteP);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     CONTRACT SCENE (Q10 — ledger)
  ────────────────────────────────────────────────────────── */

  function renderContractScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;

    var stage = el('div', { className: 'arc-contract-stage' });
    var ledger = el('div', { className: 'arc-ledger' });

    var hdr = el('div', { className: 'arc-ledger-header' });
    hdr.textContent = li === 1 ? '保管者协议 — 具有约束力' : 'KEEPER AGREEMENT — BINDING';
    ledger.appendChild(hdr);

    var body = el('div', { className: 'arc-ledger-body' });
    body.textContent = li === 1 ? q.zh.text : q.en.text;
    ledger.appendChild(body);

    for (var ci = 0; ci < q.options.length; ci++) {
      (function (opt) {
        var label = li === 1 ? opt.zh : opt.en;
        var entry = el('button', { className: 'arc-ledger-entry' });
        entry.setAttribute('aria-label', label);
        entry.setAttribute('type', 'button');

        var check = el('span', { className: 'arc-ledger-check' });
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '';
        entry.appendChild(check);

        var keySpan = el('span', { className: 'arc-ledger-entry-key' });
        keySpan.textContent = opt.value + '.';
        entry.appendChild(keySpan);

        var text = el('span', { className: 'arc-ledger-entry-text' });
        text.textContent = label;
        entry.appendChild(text);

        entry.addEventListener('click', function () {
          var all = ledger.querySelectorAll('.arc-ledger-entry');
          for (var ai = 0; ai < all.length; ai++) {
            all[ai].classList.remove('arc-ledger-entry--selected');
            all[ai].querySelector('.arc-ledger-check').textContent = '';
            all[ai].disabled = true;
          }
          entry.classList.add('arc-ledger-entry--selected');
          check.textContent = '✓';

          state.answers[qIdx] = opt.value;
          saveState();

          setTimeout(function () {
            var msg = getConsequenceMsg(qIdx, opt.value);
            showConsequence(msg, function () { advanceStep(qIdx); });
          }, 380);
        });

        ledger.appendChild(entry);
      }(q.options[ci]));
    }

    stage.appendChild(ledger);
    container.appendChild(stage);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     CORE SCENE (Q11 — five controls)
  ────────────────────────────────────────────────────────── */

  var CORE_CFG = [
    { icon: 'book',     label: ['THE DIARY',    '私人日记'] },
    { icon: 'citymap',  label: ['THE CITY MAP', '城市地图'] },
    { icon: 'word',     label: ['THE WORD',     '那个词']       },
    { icon: 'nothing',  label: ['NOTHING',      '一无所保'] },
    { icon: 'yourself', label: ['YOURSELF',     '你自己']       }
  ];

  function renderCoreScene(container, qIdx) {
    var q = QUESTIONS[qIdx];
    var li = state.lang === 'zh' ? 1 : 0;

    var stage = el('div', { className: 'arc-core-stage' });
    var coreLabel = el('div', { className: 'arc-core-label' });
    coreLabel.textContent = li === 1 ? '档案核心机器 — 最终操作' : 'ARCHIVE CORE MACHINE — FINAL OPERATION';
    stage.appendChild(coreLabel);

    var controls = el('div', { className: 'arc-core-controls' });

    for (var coi = 0; coi < q.options.length; coi++) {
      (function (opt, cfg) {
        var label = li === 1 ? opt.zh : opt.en;
        var ctrl = el('button', { className: 'arc-core-control' });
        ctrl.setAttribute('aria-label', label);
        ctrl.setAttribute('type', 'button');

        var icon = buildSvgIcon(cfg.icon);
        icon.classList.add('arc-core-ctrl-icon');
        icon.setAttribute('aria-hidden', 'true');
        ctrl.appendChild(icon);

        var lbl = el('span', { className: 'arc-core-ctrl-label' });
        lbl.textContent = cfg.label[li];
        ctrl.appendChild(lbl);

        ctrl.addEventListener('click', function () {
          var all = controls.querySelectorAll('.arc-core-control');
          for (var ai = 0; ai < all.length; ai++) {
            all[ai].classList.add('arc-core-control--faded');
            all[ai].disabled = true;
          }
          ctrl.classList.remove('arc-core-control--faded');
          ctrl.classList.add('arc-core-control--selected');

          state.answers[qIdx] = opt.value;
          saveState();

          setTimeout(function () {
            var msg = getConsequenceMsg(qIdx, opt.value);
            showConsequence(msg, function () { advanceStep(qIdx); });
          }, 450);
        });

        controls.appendChild(ctrl);
      }(q.options[coi], CORE_CFG[coi] || { icon: 'nothing', label: ['', ''] }));
    }

    stage.appendChild(controls);
    container.appendChild(stage);

    var act = ACTS[q.act];
    var narrative = el('div', { className: 'arc-narrative' });
    var actDiv = el('div', { className: 'arc-narrative-act' });
    actDiv.textContent = act.label + ' — ' + (li === 1 ? act.zh : act.en);
    narrative.appendChild(actDiv);
    var textP = el('p', { className: 'arc-narrative-text' });
    textP.textContent = li === 1 ? q.zh.text : q.en.text;
    narrative.appendChild(textP);
    container.insertBefore(narrative, container.firstChild);
  }

  /* ──────────────────────────────────────────────────────────
     PROCESSING SCENE
  ────────────────────────────────────────────────────────── */

  function renderProcessingScene(root) {
    var li = state.lang === 'zh' ? 1 : 0;
    var div = el('div', { className: 'arc-processing' });

    var scan = el('div', { className: 'arc-processing-scan' });
    scan.setAttribute('aria-hidden', 'true');
    div.appendChild(scan);

    var lines = li === 1
      ? ['档案交叉参考中', '扫描 12 个决定…', '编译保管者档案…']
      : ['ARCHIVE CROSS-REFERENCE IN PROGRESS', 'SCANNING 12 DECISIONS…', 'COMPILING KEEPER RECORD…'];
    var txt = el('div', { className: 'arc-processing-text' });
    txt.textContent = lines.join('\n');
    div.appendChild(txt);

    root.appendChild(div);
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
     KEEPER RECORD (RESULT)
  ────────────────────────────────────────────────────────── */

  function renderKeeperRecord(root) {
    var res = state.result;
    if (!res) { goToStep('intro'); return; }

    var li      = state.lang === 'zh' ? 1 : 0;
    var langKey = li === 1 ? 'zh' : 'en';

    var arch = null;
    ARCHETYPES.forEach(function (a) { if (a.id === res.archetypeId) arch = a; });
    if (!arch) arch = ARCHETYPES[0];

    var cost = null;
    COSTS.forEach(function (c) { if (c.id === res.costId) cost = c; });
    if (!cost) cost = COSTS[0];

    var ending = null;
    ENDINGS.forEach(function (e) { if (e.id === res.endingId) ending = e; });
    if (!ending) ending = ENDINGS[0];

    var scores  = res.scores;
    var archData = arch[langKey];
    var costText = cost[langKey] || '';
    var endText  = ending[langKey] || '';

    // File number hash
    var ansStr = Object.keys(state.answers).map(function (k) { return '' + state.answers[k]; }).join('');
    var hash = 0;
    for (var ci = 0; ci < ansStr.length; ci++) { hash = (hash * 31 + ansStr.charCodeAt(ci)) & 0x7fffffff; }
    var fileNo = 'NO. ' + ('00' + (Math.floor(hash / 10000) % 100)).slice(-2) + '-' + ('000' + ((hash % 9999) + 1)).slice(-3);

    var dossier = el('div', { className: 'arc-dossier' });

    // Top bar
    var topBar = el('div', { className: 'arc-dossier-topbar' });
    var topMeta = el('div', { className: 'arc-dossier-topbar-meta' });
    topMeta.textContent = li === 1
      ? 'FINAL ARCHIVE RECORD / 最终档案记录'
      : 'FINAL ARCHIVE RECORD';
    topBar.appendChild(topMeta);
    var topFileNo = el('div', { className: 'arc-dossier-fileno' });
    topFileNo.textContent = fileNo;
    topBar.appendChild(topFileNo);
    dossier.appendChild(topBar);

    var body = el('div', { className: 'arc-dossier-body' });

    // Two-column head: text + portrait
    var head = el('div', { className: 'arc-dossier-head' });
    var headText = el('div', { className: 'arc-dossier-head-text' });

    var roleLabel = el('div', { className: 'arc-dossier-role-label' });
    roleLabel.textContent = li === 1 ? '分配角色' : 'ASSIGNED ROLE';
    headText.appendChild(roleLabel);

    var title = el('h1', { className: 'arc-dossier-title' });
    title.textContent = archData.title;
    headText.appendChild(title);

    var titleSub = el('div', { className: 'arc-dossier-title-sub' });
    titleSub.textContent = li === 1 ? arch['en'].title : '';
    headText.appendChild(titleSub);

    head.appendChild(headText);

    // Portrait column
    var portraitCol = el('div', { className: 'arc-dossier-portrait-col' });
    var portrait = el('div', { className: 'arc-dossier-portrait' });
    portrait.setAttribute('aria-hidden', 'true');
    var pIcon = buildSvgIcon('door');
    pIcon.classList.add('arc-dossier-portrait-icon');
    portrait.appendChild(pIcon);
    portraitCol.appendChild(portrait);

    var sealDiv = el('div', { className: 'arc-sealed-stamp' });
    sealDiv.setAttribute('aria-hidden', 'true');
    var sealZh = el('span', { className: 'arc-sealed-stamp-zh' });
    sealZh.textContent = '已封存';
    sealDiv.appendChild(sealZh);
    var sealEn = el('span', { className: 'arc-sealed-stamp-en' });
    sealEn.textContent = 'SEALED';
    sealDiv.appendChild(sealEn);
    portraitCol.appendChild(sealDiv);

    head.appendChild(portraitCol);
    body.appendChild(head);

    var quote = el('blockquote', { className: 'arc-dossier-quote' });
    quote.textContent = '“' + archData.quote + '”';
    body.appendChild(quote);

    var desc = el('p', { className: 'arc-dossier-desc' });
    desc.textContent = archData.description;
    body.appendChild(desc);

    // Annotations table
    var ann = el('div', { className: 'arc-dossier-annotations' });
    ann.setAttribute('role', 'table');
    var annRows = [
      [li === 1 ? '保存内容' : 'PRESERVES',     archData.preserves     || ''],
      [li === 1 ? '欲望'     : 'DESIRE',         archData.desire        || ''],
      [li === 1 ? '矛盾'     : 'CONTRADICTION',  archData.contradiction || ''],
      [li === 1 ? '档案馆'   : 'THE ARCHIVE',    archData.archive       || '']
    ];
    annRows.forEach(function (row) {
      var key = el('div', { className: 'arc-ann-key' });
      key.setAttribute('role', 'rowheader');
      key.textContent = row[0];
      var val = el('div', { className: 'arc-ann-val' });
      val.setAttribute('role', 'cell');
      val.textContent = row[1];
      ann.appendChild(key);
      ann.appendChild(val);
    });
    body.appendChild(ann);

    if (state.wordInput) {
      var wordDiv = el('div', { className: 'arc-dossier-word' });
      var wordLabel = li === 1 ? '登记词语：' : 'REGISTERED WORD: ';
      wordDiv.innerHTML = wordLabel + '<em>' + state.wordInput.replace(/[<>&"]/g, function (c) {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
      }) + '</em>';
      body.appendChild(wordDiv);
    }

    var costLabel = el('div', { className: 'arc-dossier-section-label' });
    costLabel.textContent = li === 1 ? '承担的代价' : 'COST INCURRED';
    body.appendChild(costLabel);

    var costBox = el('div', { className: 'arc-cost-box' });
    costBox.textContent = costText;
    body.appendChild(costBox);

    var endLabel = el('div', { className: 'arc-dossier-section-label' });
    endLabel.textContent = li === 1 ? '最终状态' : 'FINAL STATUS';
    body.appendChild(endLabel);

    var endTextEl = el('p', { className: 'arc-ending-text' });
    endTextEl.textContent = endText;
    body.appendChild(endTextEl);

    // Signal traces
    var tracesDiv = el('div', { className: 'arc-traces' });
    var tracesLabel = el('div', { className: 'arc-dossier-section-label' });
    tracesLabel.textContent = li === 1
      ? '档案偶写  /  ARCHIVE PROFILE'
      : 'ARCHIVE PROFILE  —  INTERNAL ANALYSIS';
    tracesDiv.appendChild(tracesLabel);

    var dimLabels = {
      preservation:   li === 1 ? '保存倾向' : 'PRESERV',
      privateMeaning: li === 1 ? '私人意义' : 'PRIVATE',
      authenticity:   li === 1 ? '真实性' : 'AUTHENT',
      control:        li === 1 ? '控制感' : 'CONTROL',
      sacrifice:      li === 1 ? '牺牲倾向' : 'SACRIF'
    };

    DIMS.forEach(function (d) {
      var row = el('div', { className: 'arc-trace-row' });
      var key = el('div', { className: 'arc-trace-key' });
      key.textContent = dimLabels[d] || d;
      row.appendChild(key);

      var bg = el('div', { className: 'arc-trace-bg' });
      var fill = el('div', { className: 'arc-trace-fill' });
      fill.style.width = '0%';
      bg.appendChild(fill);
      row.appendChild(bg);

      var pct = Math.max(0, Math.min(100, (((scores[d] || 0) + 1) / 2) * 100));
      var pctEl = el('div', { className: 'arc-trace-pct' });
      pctEl.textContent = Math.round(pct) + '%';
      row.appendChild(pctEl);

      tracesDiv.appendChild(row);

      setTimeout(function () { fill.style.width = pct + '%'; }, 120);
    });
    body.appendChild(tracesDiv);

    // Actions
    var actions = el('div', { className: 'arc-dossier-actions' });

    var restartBtn = el('button', { className: 'arc-dossier-btn' });
    restartBtn.setAttribute('type', 'button');
    restartBtn.textContent = li === 1 ? '离开档案馆' : 'LEAVE ARCHIVE';
    restartBtn.addEventListener('click', function () {
      clearState();
      resetState();
      render();
    });

    var copyBtn = el('button', { className: 'arc-dossier-btn arc-dossier-btn--primary' });
    copyBtn.setAttribute('type', 'button');
    copyBtn.textContent = li === 1 ? '复制档案' : 'COPY RECORD';
    copyBtn.addEventListener('click', function () {
      copyResult(arch, langKey);
      copyBtn.textContent = li === 1 ? '已复制' : 'COPIED';
      setTimeout(function () {
        copyBtn.textContent = li === 1 ? '复制档案' : 'COPY RECORD';
      }, 2000);
    });

    var shareBtn = el('button', { className: 'arc-dossier-btn' });
    shareBtn.setAttribute('type', 'button');
    shareBtn.textContent = li === 1 ? '传输' : 'TRANSMIT';
    shareBtn.addEventListener('click', function () {
      shareResult(arch, langKey, function () { copyResult(arch, langKey); });
    });

    actions.appendChild(restartBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(shareBtn);
    body.appendChild(actions);

    dossier.appendChild(body);
    root.appendChild(dossier);
  }


  /* ──────────────────────────────────────────────────────────
     MAIN RENDER
  ────────────────────────────────────────────────────────── */

  function render() {
    var root = document.getElementById('archive-app');
    if (!root) return;

    applyVisualFlags();
    var step = state.step;
    var old = root.firstElementChild;

    function doRender() {
      while (root.firstChild) root.removeChild(root.firstChild);

      if (step === 'intro') {
        renderEntranceScene(root);
      } else if (step === 'processing') {
        renderProcessingScene(root);
      } else if (step === 'result') {
        renderKeeperRecord(root);
      } else if (typeof step === 'number' && step >= 0 && step <= 11) {
        root.appendChild(buildStatusBar(step));
        var sc = SCENES[step];
        var container = el('div', { className: 'arc-scene ' + sc.env });
        renderSceneBg(container, sc.env);
        switch (sc.type) {
          case 'object':   renderObjectScene(container, step);   break;
          case 'binary':   renderBinaryScene(container, step);   break;
          case 'document': renderDocumentScene(container, step); break;
          case 'shelf':    renderShelfScene(container, step);    break;
          case 'storage':  renderStorageScene(container, step);  break;
          case 'terminal': renderTerminalScene(container, step); break;
          case 'contract': renderContractScene(container, step); break;
          case 'core':     renderCoreScene(container, step);     break;
        }
        root.appendChild(container);
      }

      window.scrollTo(0, 0);
      if (!REDUCED_MOTION && root.firstElementChild) {
        root.firstElementChild.classList.add('arc-fade-in');
      }
    }

    if (old && !REDUCED_MOTION) {
      old.classList.add('arc-scene-exit');
      setTimeout(doRender, 260);
    } else {
      doRender();
    }
  }

  function init() {
    state.lang = normalizeLang(window.ARCHIVE_LANG);
    var saved = loadState();
    if (saved) {
      var valid = saved.step === 'intro' || saved.step === 'result' ||
        (typeof saved.step === 'number' && saved.step >= 0 && saved.step <= 11);
      if (saved.step === 'processing') { saved.step = 11; valid = true; }
      if (valid && saved.answers && saved.lang && saved.wordInput !== undefined) {
        state.step            = saved.step;
        state.answers         = saved.answers;
        state.lang            = saved.lang;
        state.wordInput       = saved.wordInput;
        state.rankingState    = saved.rankingState    || [];
        state.allocationState = saved.allocationState || {};
        state.result          = saved.result          || null;
      }
    }
    if (window.ARCHIVE_LANG) state.lang = normalizeLang(window.ARCHIVE_LANG);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render);
    } else {
      render();
    }
  }

  init();

})();
