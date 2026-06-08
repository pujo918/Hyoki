// ========== KUIS HYOKI INTERAKTIF — LOGIKA APLIKASI ==========

// Global State
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = []; // Format: { question, selectedIdx, isCorrect }
let incorrectQuestions = []; // Untuk fitur ulangi soal salah
let quizTimer = null;
let startTime = null;
let totalDuration = 0; // dalam detik
let flashcards = [];
let currentFlashcardIdx = 0;

// Helper: format priority emoji to stars
function formatPriority(prio) {
  if (!prio) return '';
  const p = prio.trim();
  if (p === '🔥') return '★★★';
  if (p === '⭐') return '★★';
  if (p === '○') return '★';
  return prio;
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const icon = document.querySelector('.theme-toggle i') || document.querySelector('.theme-toggle');
  if (icon) {
    icon.innerHTML = savedTheme === 'dark' ? '☀' : '☽';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  const btn = document.querySelector('.theme-toggle');
  btn.innerHTML = newTheme === 'dark' ? '☀' : '☽';
}

// Helper: Shuffle Array
function shuffle(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

// Helper: Generate Phonetic Distractor for Japanese Reading
function makeSimilarReading(reading) {
  const variations = [];
  
  // 1. Ubah vokal panjang (chouon)
  if (reading.includes('う')) {
    variations.push(reading.replace(/う/g, ''));
  } else {
    variations.push(reading + 'う');
  }
  
  // 2. Ubah bunyi bersuara/tidak bersuara (dakuon/seion)
  if (reading.includes('か')) variations.push(reading.replace(/か/g, 'が'));
  if (reading.includes('が')) variations.push(reading.replace(/が/g, 'か'));
  if (reading.includes('し')) variations.push(reading.replace(/し/g, 'じ'));
  if (reading.includes('じ')) variations.push(reading.replace(/じ/g, 'し'));
  if (reading.includes('た')) variations.push(reading.replace(/た/g, 'だ'));
  if (reading.includes('だ')) variations.push(reading.replace(/だ/g, 'た'));
  if (reading.includes('は')) variations.push(reading.replace(/は/g, 'ば'));
  if (reading.includes('ぱ')) variations.push(reading.replace(/ぱ/g, 'ば'));
  
  // 3. Ubah huruf vokal awal/tengah
  if (reading.includes('けい')) variations.push(reading.replace(/けい/g, 'せい'));
  if (reading.includes('せい')) variations.push(reading.replace(/せい/g, 'しょう'));
  if (reading.includes('しょう')) variations.push(reading.replace(/しょう/g, 'そう'));
  if (reading.includes('こう')) variations.push(reading.replace(/こう/g, 'きょう'));
  
  // Filter yang unik dan tidak sama dengan asli
  const validVars = variations.filter(v => v !== reading && v.length > 0);
  return validVars.length > 0 ? validVars[Math.floor(Math.random() * validVars.length)] : null;
}

// Collect Kanjis and Jukugos based on selected sessions (Pertemuan)
function getSelectedData(selectedSessions) {
  const allMeetings = {
    6: typeof pertemuan6 !== 'undefined' ? pertemuan6 : null,
    7: typeof pertemuan7 !== 'undefined' ? pertemuan7 : null,
    8: typeof pertemuan8 !== 'undefined' ? pertemuan8 : null,
    9: typeof pertemuan9 !== 'undefined' ? pertemuan9 : null,
    10: typeof pertemuan10 !== 'undefined' ? pertemuan10 : null,
    11: typeof pertemuan11 !== 'undefined' ? pertemuan11 : null,
  };
  
  let kanjis = [];
  let jukugos = [];
  
  selectedSessions.forEach(num => {
    const meet = allMeetings[num];
    if (meet && meet.kanji) {
      meet.kanji.forEach(k => {
        kanjis.push(k);
        if (k.jukugo) {
          k.jukugo.forEach(j => {
            jukugos.push({ ...j, parentKanji: k.kanji, meaningCore: k.meaning_core });
          });
        }
      });
    }
  });
  
  return { kanjis, jukugos };
}

// Generate Dinamik Soal Ganda
function generateQuiz(sessions, types, maxQuestions, order) {
  const { kanjis, jukugos } = getSelectedData(sessions);
  
  if (kanjis.length === 0 || jukugos.length === 0) {
    alert("Data untuk bab yang dipilih tidak tersedia!");
    return [];
  }
  
  const generated = [];
  
  // Jenis latihan yang dipilih
  const hasJukugoReading = types.includes('jukugo-reading');
  const hasJukugoWriting = types.includes('jukugo-writing');
  const hasBushuIdent = types.includes('bushu-identification');
  const hasBushuMean = types.includes('bushu-meaning');
  const hasArtiMean = types.includes('arti-meaning');
  const hasArtiKanji = types.includes('arti-kanji');
  
  // Tentukan bobot per kategori soal agar variatif
  const pool = [];
  
  // 1. JUKUGO CATEGORY POOL
  if ((hasJukugoReading || hasJukugoWriting) && jukugos.length > 0) {
    jukugos.forEach(j => {
      // Subtype A: Jukugo -> Cara Baca (Kanji -> Hiragana)
      if (hasJukugoReading) {
        pool.push({
          category: 'jukugo',
          subtype: 'reading',
          source: j,
          kanji: j.parentKanji
        });
      }
      // Subtype B: Hiragana -> Jukugo (Tulis Kanji)
      if (hasJukugoWriting) {
        pool.push({
          category: 'jukugo',
          subtype: 'writing',
          source: j,
          kanji: j.parentKanji
        });
      }
    });
  }
  
  // 2. ARTI CATEGORY POOL
  if ((hasArtiMean || hasArtiKanji) && jukugos.length > 0) {
    jukugos.forEach(j => {
      // Subtype A: Jukugo -> Arti Indonesia
      if (hasArtiMean) {
        pool.push({
          category: 'arti',
          subtype: 'meaning_id',
          source: j,
          kanji: j.parentKanji
        });
      }
      // Subtype B: Arti Indonesia -> Jukugo Kanji
      if (hasArtiKanji) {
        pool.push({
          category: 'arti',
          subtype: 'meaning_kanji',
          source: j,
          kanji: j.parentKanji
        });
      }
    });
  }
  
  // 3. BUSHU CATEGORY POOL
  if ((hasBushuIdent || hasBushuMean) && kanjis.length > 0) {
    kanjis.forEach(k => {
      const info = bushuData[k.kanji];
      if (info) {
        if (hasBushuIdent) {
          // Subtype A: Kanji -> Bushu Symbol/Name
          pool.push({
            category: 'bushu',
            subtype: 'kanji_bushu',
            source: k,
            kanji: k.kanji,
            bushu: info
          });
          // Subtype B: Bushu Name -> Kanji
          pool.push({
            category: 'bushu',
            subtype: 'bushu_kanji',
            source: k,
            kanji: k.kanji,
            bushu: info
          });
        }
        if (hasBushuMean) {
          // Subtype C: Makna Bushu pada Kanji
          pool.push({
            category: 'bushu',
            subtype: 'bushu_meaning',
            source: k,
            kanji: k.kanji,
            bushu: info
          });
        }
      }
    });
  }
  
  if (pool.length === 0) {
    alert("Silakan centang setidaknya satu jenis latihan!");
    return [];
  }
  
  // Acak atau Urutkan pool soal utama
  const finalPool = (order === 'random') ? shuffle(pool) : pool;
  const selectedItems = finalPool.slice(0, Math.min(maxQuestions, finalPool.length));
  
  // Buat Soal Pilihan Ganda (4 Opsi) untuk setiap item terpilih
  selectedItems.forEach(item => {
    let questionText = "";
    let questionSubtext = "";
    let questionBadge = "";
    let correctAnswer = "";
    let choices = [];
    let pembahasan = "";
    
    // Generasi Soal berdasarkan Kategori dan Subtype
    if (item.category === 'jukugo') {
      const j = item.source;
      if (item.subtype === 'reading') {
        questionBadge = "Jukugo - Cara Baca";
        questionText = `Bagaimana cara membaca jukugo dari kata berikut?<br><span style="font-size: 2.2rem; font-family: 'Noto Serif JP'; color: var(--accent);">${j.word}</span>`;
        correctAnswer = j.reading;
        
        // Pengecoh bacaan
        const dists = new Set();
        // Coba bikin phonetic distractor
        const sim = makeSimilarReading(j.reading);
        if (sim) dists.add(sim);
        
        // Ambil bacaan jukugo lain
        const otherReadings = jukugos.map(o => o.reading).filter(r => r !== j.reading);
        const shuffledOthers = shuffle(otherReadings);
        for (let r of shuffledOthers) {
          dists.add(r);
          if (dists.size >= 3) break;
        }
        
        choices = [j.reading, ...dists];
        pembahasan = `Kata <strong>${j.word}</strong> dibaca <strong>${j.reading}</strong>.<br>Arti kata: <i>${j.meaning}</i>.<br>Kanji penyusun utama: <strong>${item.kanji}</strong> (${j.meaningCore.join(', ')}).`;
      } else {
        questionBadge = "Jukugo - Tulis Kanji";
        questionText = `Manakah penulisan kanji jukugo yang tepat untuk bacaan berikut?<br><span style="font-size: 2rem; color: var(--accent);">${j.reading}</span>`;
        questionSubtext = `Arti: ${j.meaning}`;
        correctAnswer = j.word;
        
        // Pengecoh kata kanji
        const dists = new Set();
        const otherWords = jukugos.map(o => o.word).filter(w => w !== j.word);
        const shuffledOthers = shuffle(otherWords);
        for (let w of shuffledOthers) {
          dists.add(w);
          if (dists.size >= 3) break;
        }
        
        choices = [j.word, ...dists];
        pembahasan = `Bacaan <strong>${j.reading}</strong> ditulis dengan kanji <strong>${j.word}</strong>.<br>Arti kata: <i>${j.meaning}</i>.<br>Kanji <strong>${item.kanji}</strong> memiliki arti inti: <i>${j.meaningCore.join(', ')}</i>.`;
      }
    } 
    else if (item.category === 'arti') {
      const j = item.source;
      if (item.subtype === 'meaning_id') {
        questionBadge = "Arti Kata - Indonesia";
        questionText = `Apa arti yang paling tepat dari jukugo berikut?<br><span style="font-size: 2.2rem; font-family: 'Noto Serif JP'; color: var(--accent);">${j.word}</span>`;
        questionSubtext = `Bacaan: ${j.reading}`;
        correctAnswer = j.meaning;
        
        // Pengecoh arti
        const dists = new Set();
        const otherMeanings = jukugos.map(o => o.meaning).filter(m => m !== j.meaning);
        const shuffledOthers = shuffle(otherMeanings);
        for (let m of shuffledOthers) {
          dists.add(m);
          if (dists.size >= 3) break;
        }
        
        choices = [j.meaning, ...dists];
        pembahasan = `Jukugo <strong>${j.word}</strong> (${j.reading}) memiliki arti <strong>${j.meaning}</strong>.<br>Kanji <strong>${item.kanji}</strong> bermakna <i>${j.meaningCore.join(', ')}</i>.`;
      } else {
        questionBadge = "Arti Kata - Kanji";
        questionText = `Manakah jukugo yang memiliki arti bahasa Indonesia berikut?<br><span style="font-size: 1.5rem; color: var(--accent);">"${j.meaning}"</span>`;
        correctAnswer = `${j.word} (${j.reading})`;
        
        // Pengecoh jukugo + bacaan
        const dists = new Set();
        const otherItems = jukugos.filter(o => o.word !== j.word).map(o => `${o.word} (${o.reading})`);
        const shuffledOthers = shuffle(otherItems);
        for (let it of shuffledOthers) {
          dists.add(it);
          if (dists.size >= 3) break;
        }
        
        choices = [`${j.word} (${j.reading})`, ...dists];
        pembahasan = `Arti <strong>"${j.meaning}"</strong> merupakan makna dari jukugo <strong>${j.word}</strong> yang dibaca <strong>${j.reading}</strong>.`;
      }
    } 
    else if (item.category === 'bushu') {
      const k = item.source;
      const b = item.bushu;
      
      if (item.subtype === 'kanji_bushu') {
        questionBadge = "Bushu - Radikal Kanji";
        questionText = `Apa bushu (radikal) dari kanji berikut?<br><span style="font-size: 2.8rem; font-family: 'Noto Serif JP'; color: var(--accent);">${k.kanji}</span>`;
        questionSubtext = `Arti kanji: ${k.meaning_core.join(', ')}`;
        correctAnswer = `${b.radical} (${b.name})`;
        
        // Pengecoh radikal
        const dists = new Set();
        const allBushus = Object.values(bushuData).map(o => `${o.radical} (${o.name})`).filter(x => x !== correctAnswer);
        const shuffledOthers = shuffle(allBushus);
        for (let x of shuffledOthers) {
          dists.add(x);
          if (dists.size >= 3) break;
        }
        
        choices = [`${b.radical} (${b.name})`, ...dists];
        pembahasan = `Kanji <strong>${k.kanji}</strong> memiliki bushu/radikal <strong>${b.radical}</strong> yang bernama <strong>${b.name}</strong> (berarti: <i>${b.meaning}</i>).`;
      } 
      else if (item.subtype === 'bushu_kanji') {
        questionBadge = "Bushu - Cari Kanji";
        questionText = `Kanji manakah di bawah ini yang mengandung bushu/radikal berikut?<br><span style="font-size: 2rem; color: var(--accent);">${b.radical} (${b.name})</span>`;
        questionSubtext = `Keterangan bushu: ${b.meaning}`;
        correctAnswer = k.kanji;
        
        // Pengecoh kanji lain (yang tidak punya bushu yang sama)
        const dists = new Set();
        const otherKanjis = kanjis.filter(o => {
          const oInfo = bushuData[o.kanji];
          return o.kanji !== k.kanji && (!oInfo || oInfo.radical !== b.radical);
        }).map(o => o.kanji);
        
        const shuffledOthers = shuffle(otherKanjis);
        for (let oK of shuffledOthers) {
          dists.add(oK);
          if (dists.size >= 3) break;
        }
        
        // Jika cadangan kurang, ambil dari daftar universal
        if (dists.size < 3) {
          const fallback = ['国', '学', '会', '社', '人', '水', '言'].filter(x => x !== k.kanji);
          for (let f of fallback) {
            dists.add(f);
            if (dists.size >= 3) break;
          }
        }
        
        choices = [k.kanji, ...dists];
        pembahasan = `Bushu <strong>${b.radical} (${b.name})</strong> yang bermakna <i>${b.meaning}</i> dapat ditemukan pada kanji <strong>${k.kanji}</strong> (arti: ${k.meaning_core.join(', ')}).`;
      }
      else {
        questionBadge = "Bushu - Makna Radikal";
        questionText = `Apa makna/arti dari bushu <strong>${b.radical} (${b.name})</strong> yang terdapat pada kanji <strong>${k.kanji}</strong>?`;
        correctAnswer = b.meaning;
        
        // Pengecoh makna radikal
        const dists = new Set();
        const allMeanings = Object.values(bushuData).map(o => o.meaning).filter(m => m !== b.meaning);
        const shuffledOthers = shuffle(allMeanings);
        for (let m of shuffledOthers) {
          dists.add(m);
          if (dists.size >= 3) break;
        }
        
        choices = [b.meaning, ...dists];
        pembahasan = `Bushu <strong>${b.radical} (${b.name})</strong> pada kanji <strong>${k.kanji}</strong> melambangkan makna <strong>${b.meaning}</strong>.`;
      }
    }
    
    // Pastikan pilihan selalu diacak dan berjumlah 4 unik
    const uniqueChoices = [...new Set(choices)];
    while (uniqueChoices.length < 4) {
      uniqueChoices.push("Pilihan Tambahan " + uniqueChoices.length);
    }
    const finalChoices = shuffle(uniqueChoices.slice(0, 4));
    
    generated.push({
      badge: questionBadge,
      question: questionText,
      subtext: questionSubtext,
      correct: correctAnswer,
      choices: finalChoices,
      explanation: pembahasan,
      originalItem: item
    });
  });
  
  return generated;
}

// Start Quiz Session
function startQuiz(customQuestions = null) {
  if (customQuestions) {
    quizQuestions = customQuestions;
  } else {
    // Ambil pilihan dari UI
    const checkedSessions = Array.from(document.querySelectorAll('.session-checkbox:checked')).map(cb => parseInt(cb.value));
    const checkedTypes = Array.from(document.querySelectorAll('.type-checkbox:checked')).map(cb => cb.value);
    const maxQ = parseInt(document.querySelector('input[name="quiz-limit"]:checked').value);
    const order = document.querySelector('input[name="quiz-order"]:checked').value;
    
    if (checkedSessions.length === 0) {
      alert("Pilih minimal satu Pertemuan untuk diuji!");
      return;
    }
    if (checkedTypes.length === 0) {
      alert("Centang minimal satu aspek latihan (Jukugo / Bushu / Arti)!");
      return;
    }
    
    quizQuestions = generateQuiz(checkedSessions, checkedTypes, maxQ, order);
  }
  
  if (quizQuestions.length === 0) return;
  
  // Reset states
  currentQuestionIndex = 0;
  userAnswers = [];
  
  // Show quiz screen, hide others
  document.getElementById('dashboard-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.remove('hidden');
  
  // Start timer
  startTime = new Date();
  if (quizTimer) clearInterval(quizTimer);
  quizTimer = setInterval(updateTimerUI, 1000);
  
  showQuestion(currentQuestionIndex);
}

// Update Timer UI
function updateTimerUI() {
  const now = new Date();
  totalDuration = Math.floor((now - startTime) / 1000);
  const minutes = Math.floor(totalDuration / 60).toString().padStart(2, '0');
  const seconds = (totalDuration % 60).toString().padStart(2, '0');
  document.getElementById('quiz-timer').innerText = `Waktu: ${minutes}:${seconds}`;
}

// Show Question at Index
function showQuestion(idx) {
  const q = quizQuestions[idx];
  
  // Progress Bar
  const progressPercent = (idx / quizQuestions.length) * 100;
  document.getElementById('progress-bar').style.width = `${progressPercent}%`;
  document.getElementById('quiz-progress-text').innerText = `Soal ${idx + 1} dari ${quizQuestions.length}`;
  
  // Badges & Texts
  document.getElementById('q-badge').innerHTML = q.badge;
  document.getElementById('q-text').innerHTML = q.question;
  
  const sub = document.getElementById('q-subtext');
  if (q.subtext) {
    sub.innerText = q.subtext;
    sub.classList.remove('hidden');
  } else {
    sub.classList.add('hidden');
  }
  
  // Options Grid
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `
      <span class="option-btn-number">${i + 1}</span>
      <span class="option-btn-text">${choice}</span>
    `;
    btn.onclick = () => selectOption(choice, btn);
    grid.appendChild(btn);
  });
  
  // Hide explanation panel & next button
  document.getElementById('explanation-panel').classList.add('hidden');
  document.getElementById('next-btn').classList.add('hidden');
}

// Select Option / Answer Checking
function selectOption(choice, btnElement) {
  const q = quizQuestions[currentQuestionIndex];
  
  // Disable all options to prevent double clicking
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(btn => btn.setAttribute('disabled', 'true'));
  
  const isCorrect = (choice === q.correct);
  userAnswers.push({
    question: q,
    selected: choice,
    isCorrect: isCorrect
  });
  
  // Visual feedback
  if (isCorrect) {
    btnElement.classList.add('correct');
  } else {
    btnElement.classList.add('incorrect');
    // Highlight correct answer
    buttons.forEach(btn => {
      const text = btn.querySelector('.option-btn-text').innerText;
      if (text === q.correct) {
        btn.classList.add('correct');
      }
    });
  }
  
  // Show explanation
  const expPanel = document.getElementById('explanation-panel');
  const expBody = document.getElementById('explanation-body');
  
  expBody.innerHTML = `
    <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; color: ${isCorrect ? 'var(--correct)' : 'var(--incorrect)'}">
      ${isCorrect ? 'Benar!' : 'Salah!'}
    </div>
    ${q.explanation}
  `;
  expPanel.classList.remove('hidden');
  
  // Show navigation button
  const nextBtn = document.getElementById('next-btn');
  if (currentQuestionIndex === quizQuestions.length - 1) {
    nextBtn.innerHTML = 'Lihat Hasil';
  } else {
    nextBtn.innerHTML = 'Soal Berikutnya';
  }
  nextBtn.classList.remove('hidden');
}

// Go to next question or show results
function nextQuestion() {
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++;
    showQuestion(currentQuestionIndex);
  } else {
    finishQuiz();
  }
}

// Finish Quiz & Show Results
function finishQuiz() {
  if (quizTimer) clearInterval(quizTimer);
  
  document.getElementById('quiz-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  
  // Calculate stats
  const correctCount = userAnswers.filter(a => a.isCorrect).length;
  const incorrectCount = userAnswers.length - correctCount;
  const score = Math.round((correctCount / userAnswers.length) * 100);
  
  // Update Score Circle & Stats Card
  document.getElementById('score-num').innerText = score;
  document.getElementById('stat-correct').innerText = correctCount;
  document.getElementById('stat-incorrect').innerText = incorrectCount;
  
  const min = Math.floor(totalDuration / 60);
  const sec = totalDuration % 60;
  document.getElementById('stat-time').innerText = `${min}m ${sec}s`;
  
  // Collect failed questions for retry
  incorrectQuestions = userAnswers.filter(a => !a.isCorrect).map(a => a.question);
  const retryBtn = document.getElementById('retry-failed-btn');
  if (incorrectQuestions.length > 0) {
    retryBtn.classList.remove('hidden');
    retryBtn.innerHTML = `Ulangi Soal Salah (${incorrectQuestions.length})`;
  } else {
    retryBtn.classList.add('hidden');
  }
  
  // Render collapsible review logs
  renderReviewLogs();
}

// Render Collapsible Review Logs
function renderReviewLogs() {
  const container = document.getElementById('review-container');
  container.innerHTML = '';
  
  userAnswers.forEach((ans, i) => {
    const q = ans.question;
    const item = document.createElement('div');
    item.className = 'review-item';
    
    item.innerHTML = `
      <div class="review-header" onclick="toggleReviewBody(this)">
        <div class="review-header-left">
          <span class="review-badge ${ans.isCorrect ? 'correct' : 'incorrect'}">
            ${ans.isCorrect ? 'BENAR' : 'SALAH'}
          </span>
          <span style="font-size: 0.95rem;">Soal ${i + 1}: ${q.badge.split(' - ')[1] || 'Kuis'}</span>
        </div>
        <span class="toggle-icon">+</span>
      </div>
      
      <div class="review-body">
        <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">
          ${q.question}
        </div>
        ${q.subtext ? `<div style="color:var(--text-muted); margin-bottom: 1rem;">${q.subtext}</div>` : ''}
        
        <div class="review-choices">
          ${q.choices.map(c => {
            let cls = '';
            if (c === q.correct) cls = 'correct';
            else if (c === ans.selected && !ans.isCorrect) cls = 'selected';
            return `<div class="review-choice ${cls}">${c}</div>`;
          }).join('')}
        </div>
        
        <div class="explanation-panel" style="margin-top: 1rem; border-color: var(--accent);">
          <div class="explanation-title">Pembahasan Detail:</div>
          <div class="explanation-body">${q.explanation}</div>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Toggle Review Body Expand/Collapse
function toggleReviewBody(headerElement) {
  const body = headerElement.nextElementSibling;
  const icon = headerElement.querySelector('.toggle-icon');
  
  if (body.style.display === 'block') {
    body.style.display = 'none';
    icon.innerText = '+';
  } else {
    body.style.display = 'block';
    icon.innerText = '-';
  }
}

// Retry only failed questions
function retryFailedQuestions() {
  if (incorrectQuestions.length === 0) return;
  
  // Re-shuffle failed questions
  const shuffledRetry = shuffle(incorrectQuestions);
  startQuiz(shuffledRetry);
}

// Switch Dashboard Screen Tabs (Quiz vs Study)
function switchDashboardTab(tab) {
  const quizBtn = document.getElementById('tab-quiz-btn');
  const studyBtn = document.getElementById('tab-study-btn');
  const setupArea = document.getElementById('quiz-setup-area');
  const studyArea = document.getElementById('study-area');
  
  if (tab === 'quiz') {
    quizBtn.classList.add('active');
    studyBtn.classList.remove('active');
    setupArea.classList.remove('hidden');
    studyArea.classList.add('hidden');
  } else {
    studyBtn.classList.add('active');
    quizBtn.classList.remove('active');
    studyArea.classList.remove('hidden');
    setupArea.classList.add('hidden');
  }
}

// Helper to retrieve session databases
function getMeetingData(sessionNum) {
  const allMeetings = {
    6: typeof pertemuan6 !== 'undefined' ? pertemuan6 : null,
    7: typeof pertemuan7 !== 'undefined' ? pertemuan7 : null,
    8: typeof pertemuan8 !== 'undefined' ? pertemuan8 : null,
    9: typeof pertemuan9 !== 'undefined' ? pertemuan9 : null,
    10: typeof pertemuan10 !== 'undefined' ? pertemuan10 : null,
    11: typeof pertemuan11 !== 'undefined' ? pertemuan11 : null,
  };
  return allMeetings[sessionNum];
}

// Modal Study Popup Management
function openStudyModal(sessionNum) {
  const modal = document.getElementById('study-modal');
  modal.setAttribute('data-session', sessionNum);
  modal.classList.remove('hidden');
  renderKanjiGrid(sessionNum);
}

// Render Kanji grid (Initial view of the study modal)
function renderKanjiGrid(sessionNum) {
  const modal = document.getElementById('study-modal');
  modal.setAttribute('data-view-mode', 'grid');
  
  const title = document.getElementById('modal-title');
  const container = document.getElementById('modal-body-container');
  const searchInput = document.getElementById('modal-search');
  const searchContainer = document.getElementById('modal-search-container');
  
  title.innerText = `Daftar Kanji — Pertemuan ${sessionNum}`;
  searchInput.value = '';
  searchInput.placeholder = `Cari kanji atau makna...`;
  if (searchContainer) searchContainer.style.display = ''; // Show search bar
  
  const meet = getMeetingData(sessionNum);
  if (!meet || !meet.kanji) {
    container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">Data tidak tersedia!</div>';
    return;
  }
  
  let gridHtml = '<div class="kanji-grid">';
  meet.kanji.forEach(k => {
    gridHtml += `
      <div class="kanji-card" data-kanji="${k.kanji.toLowerCase()}" data-meaning="${k.meaning_core.join(' ').toLowerCase()}">
        <div class="kanji-card-char">${k.kanji}</div>
        <div class="kanji-card-meaning">${k.meaning_core.join(', ')}</div>
        <div class="kanji-card-actions">
          <button class="kanji-card-btn" onclick="renderSingleKanjiJukugo('${k.kanji}', ${sessionNum})">Jukugo</button>
          <button class="kanji-card-btn fc-btn" onclick="startKanjiFlashcards('${k.kanji}', ${sessionNum})">Flashcard</button>
        </div>
      </div>
    `;
  });
  gridHtml += '</div>';
  
  container.innerHTML = `
    <div class="study-modal-actions">
      <div style="font-size:0.85rem; color:var(--text-muted);">Pilih kanji untuk belajar jukugo atau latihan flashcard.</div>
      <a class="view-all-link" onclick="renderAllJukugo(${sessionNum})">Lihat semua jukugo pertemuan ${sessionNum}</a>
    </div>
    ${gridHtml}
  `;
}

// Render all Jukugos of the session in a table list (old format)
function renderAllJukugo(sessionNum) {
  const modal = document.getElementById('study-modal');
  modal.setAttribute('data-view-mode', 'all');
  
  const title = document.getElementById('modal-title');
  const container = document.getElementById('modal-body-container');
  const searchInput = document.getElementById('modal-search');
  const searchContainer = document.getElementById('modal-search-container');
  
  title.innerText = `Kosakata Jukugo — Pertemuan ${sessionNum}`;
  searchInput.value = '';
  searchInput.placeholder = `Cari jukugo, bacaan, atau arti...`;
  if (searchContainer) searchContainer.style.display = ''; // Show search bar
  
  const meet = getMeetingData(sessionNum);
  if (!meet || !meet.kanji) {
    container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">Data tidak tersedia!</div>';
    return;
  }
  
  let html = '';
  meet.kanji.forEach(k => {
    if (k.jukugo && k.jukugo.length > 0) {
      const parentKanji = k.kanji;
      const meaningCore = k.meaning_core.join(', ');
      
      let rowsHtml = '';
      k.jukugo.forEach(j => {
        rowsHtml += `
          <tr class="study-row" data-word="${j.word}" data-reading="${j.reading}" data-meaning="${j.meaning}" data-parent="${parentKanji}">
            <td class="study-word">${j.word}</td>
            <td class="study-reading">${j.reading}</td>
            <td class="study-meaning">${j.meaning}</td>
            <td class="study-prio">${formatPriority(j.priority)}</td>
          </tr>
        `;
      });
      
      html += `
        <div class="study-kanji-group" data-kanji="${parentKanji}">
          <div class="study-kanji-title">
            <span class="study-kanji-char">${parentKanji}</span>
            <span>Inti: ${meaningCore}</span>
          </div>
          <table class="study-table">
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  });
  
  container.innerHTML = `
    <div class="study-modal-actions">
      <button class="back-to-grid-btn" onclick="renderKanjiGrid(${sessionNum})">Kembali ke Daftar Kanji</button>
    </div>
    ${html || '<div style="color:var(--text-muted); text-align:center; padding:2rem;">Tidak ada jukugo.</div>'}
  `;
}

// Render Jukugo lists for a single selected kanji
function renderSingleKanjiJukugo(kanjiChar, sessionNum) {
  const modal = document.getElementById('study-modal');
  modal.setAttribute('data-view-mode', 'single');
  
  const title = document.getElementById('modal-title');
  const container = document.getElementById('modal-body-container');
  const searchContainer = document.getElementById('modal-search-container');
  
  title.innerText = `Jukugo Kanji [ ${kanjiChar} ]`;
  if (searchContainer) searchContainer.style.display = 'none'; // Hide search bar
  
  const meet = getMeetingData(sessionNum);
  if (!meet || !meet.kanji) return;
  
  const k = meet.kanji.find(item => item.kanji === kanjiChar);
  if (!k) return;
  
  let rowsHtml = '';
  if (k.jukugo) {
    k.jukugo.forEach(j => {
      rowsHtml += `
        <tr class="study-row">
          <td class="study-word">${j.word}</td>
          <td class="study-reading">${j.reading}</td>
          <td class="study-meaning">${j.meaning}</td>
          <td class="study-prio">${formatPriority(j.priority)}</td>
        </tr>
      `;
    });
  }
  
  const singleHtml = `
    <div class="study-kanji-group">
      <div class="study-kanji-title">
        <span class="study-kanji-char">${k.kanji}</span>
        <span>Inti: ${k.meaning_core.join(', ')}</span>
      </div>
      <table class="study-table">
        <tbody>
          ${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Tidak ada jukugo untuk kanji ini.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = `
    <div class="study-modal-actions">
      <button class="back-to-grid-btn" onclick="renderKanjiGrid(${sessionNum})">Kembali ke Daftar Kanji</button>
      <button class="btn-primary" onclick="startKanjiFlashcards('${kanjiChar}', ${sessionNum})" style="padding: 0.5rem 1rem; font-size: 0.82rem; border-radius:0.6rem; margin: 0; box-shadow: none;">Mulai Flashcard</button>
    </div>
    ${singleHtml}
  `;
}

// Flashcard Practicing per Kanji
function startKanjiFlashcards(kanjiChar, sessionNum) {
  const modal = document.getElementById('study-modal');
  modal.setAttribute('data-view-mode', 'flashcard');
  
  const title = document.getElementById('modal-title');
  const searchContainer = document.getElementById('modal-search-container');
  
  title.innerText = `Flashcard Kanji [ ${kanjiChar} ]`;
  if (searchContainer) searchContainer.style.display = 'none'; // Hide search bar
  
  const meet = getMeetingData(sessionNum);
  if (!meet || !meet.kanji) return;
  
  const k = meet.kanji.find(item => item.kanji === kanjiChar);
  if (!k || !k.jukugo || k.jukugo.length === 0) {
    alert("Tidak ada jukugo untuk latihan flashcard pada kanji ini!");
    return;
  }
  
  // Set global flashcards list
  flashcards = k.jukugo;
  currentFlashcardIdx = 0;
  
  showFlashcard(kanjiChar, sessionNum);
}

function showFlashcard(kanjiChar, sessionNum) {
  const container = document.getElementById('modal-body-container');
  const card = flashcards[currentFlashcardIdx];
  
  const isFirst = currentFlashcardIdx === 0;
  const isLast = currentFlashcardIdx === flashcards.length - 1;
  
  container.innerHTML = `
    <div class="flashcard-container">
      <div class="flashcard-progress">Kartu ${currentFlashcardIdx + 1} dari ${flashcards.length}</div>
      
      <div class="flashcard-card" id="flashcard-element" onclick="flipFlashcard()">
        <div class="flashcard-inner">
          <div class="flashcard-front">
            <div class="flashcard-japanese">${card.word}</div>
            <div class="flashcard-hint">Klik kartu untuk membalik</div>
          </div>
          <div class="flashcard-back">
            <div class="flashcard-reading">${card.reading}</div>
            <div class="flashcard-divider"></div>
            <div class="flashcard-meaning">${card.meaning}</div>
            <div class="flashcard-prio">${formatPriority(card.priority)}</div>
          </div>
        </div>
      </div>
      
      <div class="flashcard-controls">
        <button class="btn-secondary" onclick="prevFlashcard('${kanjiChar}', ${sessionNum})" ${isFirst ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>Sebelumnya</button>
        <button class="btn-primary" onclick="flipFlashcard()" style="margin: 0; box-shadow: none;">Balik</button>
        <button class="btn-secondary" onclick="nextFlashcard('${kanjiChar}', ${sessionNum})" ${isLast ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>Selanjutnya</button>
      </div>
      
      <button class="btn-secondary" onclick="renderSingleKanjiJukugo('${kanjiChar}', ${sessionNum})" style="margin-top: 1.5rem; justify-content: center; width: 100%; max-width: 360px;">
        Kembali ke Jukugo [${kanjiChar}]
      </button>
    </div>
  `;
}

function flipFlashcard() {
  const cardElement = document.getElementById('flashcard-element');
  if (cardElement) {
    cardElement.classList.toggle('flipped');
  }
}

function nextFlashcard(kanjiChar, sessionNum) {
  if (currentFlashcardIdx < flashcards.length - 1) {
    currentFlashcardIdx++;
    showFlashcard(kanjiChar, sessionNum);
  }
}

function prevFlashcard(kanjiChar, sessionNum) {
  if (currentFlashcardIdx > 0) {
    currentFlashcardIdx--;
    showFlashcard(kanjiChar, sessionNum);
  }
}

// Close Study Modal
function closeStudyModal(event) {
  const modal = document.getElementById('study-modal');
  modal.classList.add('hidden');
  const searchContainer = document.getElementById('modal-search-container');
  if (searchContainer) searchContainer.style.display = '';
}

// Filter Study List inside the Modal
function filterModalStudyList() {
  const query = document.getElementById('modal-search').value.toLowerCase().trim();
  const modal = document.getElementById('study-modal');
  const viewMode = modal.getAttribute('data-view-mode') || 'grid';
  
  if (viewMode === 'grid') {
    const cards = document.querySelectorAll('#modal-body-container .kanji-card');
    cards.forEach(card => {
      const kanji = card.getAttribute('data-kanji') || '';
      const meaning = card.getAttribute('data-meaning') || '';
      const match = kanji.includes(query) || meaning.includes(query);
      card.style.display = match ? '' : 'none';
    });
  } else if (viewMode === 'all') {
    const groups = document.querySelectorAll('#modal-body-container .study-kanji-group');
    groups.forEach(group => {
      const kanjiChar = group.getAttribute('data-kanji').toLowerCase();
      const rows = group.querySelectorAll('.study-row');
      let groupVisible = false;
      
      rows.forEach(row => {
        const word = row.getAttribute('data-word').toLowerCase();
        const reading = row.getAttribute('data-reading').toLowerCase();
        const meaning = row.getAttribute('data-meaning').toLowerCase();
        
        const match = word.includes(query) || reading.includes(query) || meaning.includes(query) || kanjiChar.includes(query);
        if (match) {
          row.style.display = '';
          groupVisible = true;
        } else {
          row.style.display = 'none';
        }
      });
      
      if (groupVisible) {
        group.style.display = '';
      } else {
        group.style.display = 'none';
      }
    });
  }
}

// Checkbox Synchronization Helpers
function syncStudyList() {
  const checkedSessions = Array.from(document.querySelectorAll('.session-checkbox:checked')).map(cb => cb.value);
  const cards = document.querySelectorAll('#study-area .study-card');
  cards.forEach(card => {
    const onclickStr = card.getAttribute('onclick') || '';
    const match = onclickStr.match(/\d+/);
    if (match) {
      const sessionNum = match[0];
      if (checkedSessions.includes(sessionNum)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    }
  });
}

function onSessionCheckboxChange() {
  syncStudyList();
  updateSelectAllSessionsState();
}

function toggleSelectAllSessions() {
  const selectAll = document.getElementById('select-all-sessions');
  if (!selectAll) return;
  const checkboxes = document.querySelectorAll('.session-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = selectAll.checked;
  });
  selectAll.indeterminate = false;
  syncStudyList();
}

function updateSelectAllSessionsState() {
  const selectAll = document.getElementById('select-all-sessions');
  if (!selectAll) return;
  const checkboxes = document.querySelectorAll('.session-checkbox');
  let checkedCount = 0;
  checkboxes.forEach(cb => {
    if (cb.checked) checkedCount++;
  });
  
  if (checkedCount === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  } else if (checkedCount === checkboxes.length) {
    selectAll.checked = true;
    selectAll.indeterminate = false;
  } else {
    selectAll.checked = false;
    selectAll.indeterminate = true;
  }
}

function toggleGroupCheckboxes(parentId, childClass) {
  const parent = document.getElementById(parentId);
  if (!parent) return;
  const children = document.querySelectorAll(`.${childClass}`);
  children.forEach(child => {
    child.checked = parent.checked;
  });
  parent.indeterminate = false;
  
  updateSelectAllAspectsState();
}

function updateParentCheckbox(parentId, childClass) {
  const parent = document.getElementById(parentId);
  if (!parent) return;
  const children = document.querySelectorAll(`.${childClass}`);
  
  let checkedCount = 0;
  children.forEach(child => {
    if (child.checked) checkedCount++;
  });
  
  if (checkedCount === 0) {
    parent.checked = false;
    parent.indeterminate = false;
  } else if (checkedCount === children.length) {
    parent.checked = true;
    parent.indeterminate = false;
  } else {
    parent.checked = false;
    parent.indeterminate = true;
  }
  
  updateSelectAllAspectsState();
}

function toggleSelectAllAspects() {
  const selectAll = document.getElementById('select-all-aspects');
  if (!selectAll) return;
  
  const mainAspects = ['aspect-jukugo', 'aspect-bushu', 'aspect-arti'];
  const subClasses = ['sub-jukugo', 'sub-bushu', 'sub-arti'];
  
  mainAspects.forEach(id => {
    const parent = document.getElementById(id);
    if (parent) {
      parent.checked = selectAll.checked;
      parent.indeterminate = false;
    }
  });
  
  subClasses.forEach(cls => {
    const children = document.querySelectorAll(`.${cls}`);
    children.forEach(child => {
      child.checked = selectAll.checked;
    });
  });
  
  selectAll.indeterminate = false;
}

function updateSelectAllAspectsState() {
  const selectAll = document.getElementById('select-all-aspects');
  if (!selectAll) return;
  
  const children = document.querySelectorAll('.type-checkbox');
  let checkedCount = 0;
  children.forEach(child => {
    if (child.checked) checkedCount++;
  });
  
  if (checkedCount === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  } else if (checkedCount === children.length) {
    selectAll.checked = true;
    selectAll.indeterminate = false;
  } else {
    selectAll.checked = false;
    selectAll.indeterminate = true;
  }
}

// Toggle Collapse/Expand aspect options
function toggleAspectCollapse(collapseId, headerElement) {
  const subAspects = document.getElementById(collapseId);
  if (!subAspects) return;
  
  const arrow = headerElement.querySelector('.arrow-icon');
  const isCollapsed = subAspects.classList.contains('collapsed');
  
  if (isCollapsed) {
    subAspects.classList.remove('collapsed');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  } else {
    subAspects.classList.add('collapsed');
    if (arrow) arrow.style.transform = 'rotate(-90deg)';
  }
}

// Reset and return to Dashboard
function returnToDashboard() {
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
}

// Confirm and exit during an active quiz session
function confirmExitQuiz() {
  if (confirm("Apakah Anda yakin ingin keluar dari kuis? Progress latihan saat ini akan hilang.")) {
    if (quizTimer) clearInterval(quizTimer);
    returnToDashboard();
  }
}

// Init Setup on Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  // Sync checkbox states on load
  updateParentCheckbox('aspect-jukugo', 'sub-jukugo');
  updateParentCheckbox('aspect-bushu', 'sub-bushu');
  updateParentCheckbox('aspect-arti', 'sub-arti');
  updateSelectAllSessionsState();
  updateSelectAllAspectsState();
  syncStudyList();
  
  // Listeners for radio cards visual selection
  const radios = document.querySelectorAll('input[type="radio"]');
  radios.forEach(r => {
    r.addEventListener('change', () => {
      const groupName = r.getAttribute('name');
      document.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
        input.parentElement.classList.remove('checked');
      });
      if (r.checked) {
        r.parentElement.classList.add('checked');
      }
    });
  });
});
