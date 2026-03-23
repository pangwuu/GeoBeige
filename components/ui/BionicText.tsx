import React from 'react';

interface BionicTextProps {
  text: string;
}

const BionicText = ({ text }: BionicTextProps) => {
  if (!text) return null;
  
  // Clean text of any existing markdown bolding first
  const cleanText = text.replace(/\*\*/g, '');
  
  const words = cleanText.split(/(\s+)/);
  return (
    <>
      {words.map((word, i) => {
        if (/\s+/.test(word)) return word;
        
        // Handle words with punctuation
        const match = word.match(/^(\W*)(.*?)(\W*)$/);
        if (!match) return word;
        
        const [_, prefix, core, suffix] = match;
        if (!core) return word;
        
        // Bold the first 40% of the word, minimum 1 character
        const boldLength = Math.max(1, Math.ceil(core.length * 0.4));
        const boldPart = core.substring(0, boldLength);
        const normalPart = core.substring(boldLength);
        
        return (
          <span key={i}>
            {prefix}
            <strong className="font-extrabold text-foreground">{boldPart}</strong>
            <span className="opacity-60 font-medium">{normalPart}</span>
            {suffix}
          </span>
        );
      })}
    </>
  );
};

export default BionicText;
