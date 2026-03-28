const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const replaceMap = [
        [/\btext-white\b/g, 'text-slate-900 dark:text-white'],
        [/\btext-gray-300\b/g, 'text-slate-700 dark:text-gray-300'],
        [/\btext-gray-400\b/g, 'text-slate-600 dark:text-gray-400'],
        [/\btext-gray-500\b/g, 'text-slate-500 dark:text-gray-500'],
        [/\bbg-black\/40\b/g, 'bg-white/60 dark:bg-black/40'],
        [/\bbg-black\/50\b/g, 'bg-white/80 dark:bg-black/50'],
        [/\bbg-white\/5\b/g, 'bg-slate-200/50 dark:bg-white/5'],
        [/\bhover:bg-white\/10\b/g, 'hover:bg-slate-300/50 dark:hover:bg-white/10'],
        [/\bborder-white\/5\b/g, 'border-slate-300 dark:border-white/5'],
        [/\bborder-white\/10\b/g, 'border-slate-300 dark:border-white/10'],
        [/\bfrom-\[#0a0514\]\b/g, 'from-indigo-50 dark:from-[#0a0514]'],
        [/\bvia-\[#050508\]\b/g, 'via-purple-50 dark:via-[#050508]'],
        [/\bto-black\b/g, 'to-slate-100 dark:to-black'],
        [/\bfrom-violet-950\b/g, 'from-violet-100 dark:from-violet-950'],
        [/\bfrom-indigo-950\b/g, 'from-indigo-100 dark:from-indigo-950']
    ];

    let newContent = content;
    // VERY simple naive replacer to avoid breaking things, we assume classes are just strings
    // We actually only want to replace tailwind classes, but since `text-white` doesn't often appear naturally outside of classNames, regex \b is safe enough.
    replaceMap.forEach(([regex, replacement]) => {
         // To prevent double replacement if script is run twice, we do a negative lookbehind (hard in JS string regex for variable length, so we just run it once)
         newContent = newContent.replace(regex, replacement);
    });

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('Updated ' + filePath);
    }
}

const dir = path.join(__dirname, 'src', 'components');
fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.jsx')) processFile(path.join(dir, file));
});
processFile(path.join(__dirname, 'src', 'App.jsx'));
console.log('Theme patching complete.');
