# Original works

Poems and stories written for Bibliotheca, one folder per collection (see the entries with
`"original": true` in `tts/books.json`).

To add a poem by Andreea Stroila, create a new text file in `andreea-stroila/`, named with the next
number, for example `03-titlul-poemului.txt`. The first line is the title, then an empty line, then
the poem exactly as it should be read. The daily run narrates it in both voices (female Gacrux and
male Algieba) and adds it to the collection. To do it right away:

    python3 tts/originals.py --all
    npm run catalog

To start a new collection (another author or another volume), copy the Andreea Stroila entry in
`tts/books.json`, change `slug`, `title`, `folder`, `palette` and `blurb`, and create the folder.
