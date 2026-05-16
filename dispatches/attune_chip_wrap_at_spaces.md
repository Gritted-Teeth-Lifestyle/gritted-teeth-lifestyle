# Attune chip text — wrap at word boundaries only

**Target:** GTL 3 worker. Branch: `dev`. File: `components/attune/SetChip.jsx`.

## DIAGNOSIS

`word-break: break-word` splits long names mid-character (e.g., `KNEELIN/G LAT/PULLDOW/N`). Want word-boundary wrap only (e.g., `1-ARM/HALF-KNEELING/LAT/PULLDOWN`).

## CHANGE

In `components/attune/SetChip.jsx`, find the inner label `<span>`:

```jsx
        <span style={{
          flex: 1, minWidth: 0,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          lineHeight: 1.2,
        }}>
          {label}
        </span>
```

Replace with:

```jsx
        <span style={{
          flex: 1, minWidth: 0,
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          lineHeight: 1.2,
        }}>
          {label}
        </span>
```

Behavior change: `wordBreak: normal` keeps words intact. `overflowWrap: break-word` only breaks a word mid-character if a single word is itself wider than the chip — otherwise wrap happens at spaces.

## DO NOT

- Touch any other file or any other style.

## Commit and push

```
Attune chip wrap: word-boundary wrapping (no mid-letter splits)
```

Push to `origin/dev`.

## Report

- Commit hash + 1 screenshot showing a long name wrapped at word boundaries.
