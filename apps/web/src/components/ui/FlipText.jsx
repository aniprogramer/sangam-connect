import React from "react";
import styles from "./FlipText.module.css";
import { cn } from "../../lib/utils";

/**
 * FlipText - Vengeance UI kinetic text component
 * Provides elegant 3D flipping animation for headings
 */
export function FlipText({
  children,
  duration = 5,
  stagger = 0.05,
  className = "",
  as: Component = "span",
}) {
  if (typeof children !== "string") {
    return <Component className={className}>{children}</Component>;
  }

  const words = children.split(" ");
  let globalCharIndex = 0;

  return (
    <Component className={cn(styles.flipTextContainer, className)}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className={styles.word}>
          {word.split("").map((char, charIndex) => {
            const delay = globalCharIndex * stagger;
            globalCharIndex++;
            return (
              <span
                key={charIndex}
                className={styles.char}
                style={{
                  "--duration": `${duration}s`,
                  "--char-delay": `${delay}s`,
                }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </Component>
  );
}

export default FlipText;
