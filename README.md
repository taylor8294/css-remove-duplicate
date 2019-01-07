# CSS Remove Duplicate

A NodeJS script that will remove all redundant style declarations from a child CSS file, given a parent CSS file it inherits from. That is, removes all style declarations from the child that are already present in the parent file (and thus duplicated unnecessarily).

## Table of Contents

- [License](#license)
- [Installation](#installation)
- [Usage](#usage)

## License

### Commercial license

If you want to use this to develop commercial sites, tools, projects, or applications, the Commercial license is the appropriate license. With this option, your source code is kept proprietary. To acquire a Commercial License please [contact me](https://www.taylrr.co.uk/).

### Open source license

If you are creating an open source application under a license compatible with the [GNU GPL license v3](https://www.gnu.org/licenses/gpl-3.0.html), you may use this code under the terms of the GPLv3.

## Installation

Download and install [NodeJS](https://nodejs.org) on your machine if you have not already done so. Once installed, simply clone this repo locally and run `npm install`

```sh
git clone https://github.com/taylor8294/css-remove-duplicate.git
cd css-remove-duplicate
npm install
```

## Getting started

Try running `npm test` to check everything is working. You should see `Removed 47 of 60 CSS declarations (78%)` logged to the screen, followed by `See ./test/test.child.out.css`. If an error occurs, look into the error message to see why it failed.

## Usage

Make a folder in the root of the project, `css` say, and place the CSS files you wish to work with in there.

```sh
mkdir css
cp -p $(find /path/to/folder -type f -name "*.css") css
```

Make a copy of `example.config.json` named `config.json` and edit for your needs, feel free to remove any of the options from `config.json` to rely on the default instead.

```sh
cp example.config.json config.json
nano config.json
```

| Option | Description | Default |
| --- | --- | --- |
| `parentFile` | Path to single parent CSS file. | `"./parent.css"`
| `childFile` | Path to child CSS file -- can be a glob pattern to run the tool on multiple child files | `"./child.css"`
| `outputDir` | Folder where the resulting child files will be saved. | `"./out"`
| `outputFilename` | The filename used to save the resulting child CSS file in `outputDir`. Leave as `false` to use name of the input file -- must be `false` if `childFile` is a glob pattern or the output file will get overwritten each time. | `false`
| `outputFileExt` | Only if `outputFilename` is false, this replaces ".css" in the input file name with the given string | `".out.css"`
| `combineSelectors` | Whether CSS selectors with the same style declarations should be combined - setting to `false` effectively sets a maximum of one CSS selector per CSS rule (even if CSS selectors where combined in the input file) | `true`
| `removeComments` | By default all top-level comments in the child CSS file will remain in place regardless. All rule-level comments inside an at-rule (such as inside a `@media-query`) will remain in place as long as that at-rule is still present in the resulting child CSS file. Declaration-level comments will remain in place if the style declaration they immediately precede (or follow if the comment is at the end of a CSS rule) remains in the resulting CSS file, if not they are removed along with the declaration. Setting this option to `true` removes all comments, that is, the resulting CSS file will contain no comments at all. | `false`
| `commentsSameLine` | This is a formatting option, if set to `true` all comments immediately following a style declaration will be on the same line as that declaration, rather than the line below. However, it also has a functional purpose, if set to `true` and `removeComments` is false, declaration-level comments will remain in place if the style declaration they immediately *follow* (or *precede* if the comment is at the *start* of a CSS rule) remains in the resulting CSS file, as opposed to the other way round if this is `false` (see description of `removeComments` option) | `false`
| `removeEmptyLines` | This is a formatting option, if set to `true` all empty lines that were in the child CSS file will be removed, each style rule will be immediately follwed by the next. | `false`
| `verbose` | Verbose output | `false`
| `silent` | If `true` no output to the console (overridden by `verbose`) | `false`
| `logResult` | If true, the resulting child CSS is logged to the console before the script completes | `false`
| `returnString` | If true, the call the `CSSRemoveDuplicate` function returns the resulting CSS as a string rather than writing to an output file | `false`

Once the config is all setup you should just be able to run `npm start` to get your new reduce child CSS file.

You can also run `npm start -- -c /path/to/config.json` to specify the path to the config file on the command line (this is how `npm test` passes the `test.config.json` file).

---

This software is provided 'as-is', without any express or implied warranty. In no event will the authors be held liable for any damages arising from the use of this software. Use at own risk.

By [Taylor8294 🌈🐻](https://www.taylrr.co.uk/)