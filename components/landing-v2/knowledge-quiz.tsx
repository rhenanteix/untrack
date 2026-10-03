"use client";

import { useState } from "react";

const questions = [
  {
    id: "q1",
    question: "Você sabe de qual canal vieram seus acessos?",
  },
  {
    id: "q2",
    question: "Você sabe qual QR Code trouxe mais pessoas?",
  },
  {
    id: "q3",
    question: "Você sabe qual campanha gerou seus contatos?",
  },
  {
    id: "q4",
    question: "Você sabe quais ações aconteceram depois do clique?",
  },
] as const;

export function KnowledgeQuiz() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => {
    setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const score = Object.values(answers).filter(Boolean).length;

  return (
    <section className="lv2-quiz">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Quanto você sabe?</span>
          <h2 className="lv2-section-title">
            Quanto você realmente sabe sobre seus links?
          </h2>
        </div>

        <div className="lv2-quiz-list">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`lv2-quiz-item ${
                answers[q.id] !== undefined ? "lv2-quiz-item--answered" : ""
              }`}
            >
              <p>{q.question}</p>
              <div className="lv2-quiz-options">
                <button
                  type="button"
                  className={`lv2-quiz-option ${
                    answers[q.id] === true ? "lv2-quiz-option--active" : ""
                  }`}
                  onClick={() => toggle(q.id)}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className={`lv2-quiz-option ${
                    answers[q.id] === false ? "lv2-quiz-option--active" : ""
                  }`}
                  onClick={() => toggle(q.id)}
                >
                  Não
                </button>
              </div>
            </div>
          ))}
        </div>

        {submitted ? (
          <div className="lv2-quiz-result">
            <p>
              Hoje você acompanha <strong>{score} de {questions.length}</strong>{" "}
              pontos dessa jornada.
            </p>
            <p>
              Com o LinkOr você pode acompanhar: origem, campanha, QR, links,
              interações e conversões.
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="lv2-btn lv2-btn-primary"
            onClick={() => setSubmitted(true)}
            disabled={score === 0}
          >
            Ver resultado
          </button>
        )}
      </div>
    </section>
  );
}
