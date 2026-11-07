# Analyse de données — Prospect Hub

Chaîne de traitement en Python sur les 283 entreprises de Marrakech collectées via
l'API Google Places. Trois étapes, exécutées dans l'ordre : explorer, nettoyer,
analyser. Chaque étape écrit ses résultats dans `outputs/`, et ne modifie jamais le
fichier source `../app/data/companies.csv`.

## Exécution

```bash
pip install pandas matplotlib numpy
cd analysis
python 01_explore.py     # profil du dataset brut   -> outputs/exploration.json
python 02_clean.py       # nettoyage                -> outputs/companies_clean.csv
python 03_analyze.py     # analyse + figures        -> outputs/analysis.json
```

## Étape 1 — Exploration

Mesure l'état du fichier brut sans rien corriger, pour que l'étape 2 traite des
problèmes constatés et non supposés.

| Constat | Mesure |
|---|---|
| Valeurs manquantes | email 142 (50 %), site web 62 (22 %), catégorie / note / avis 18 (6 %) |
| Doublons | 0 `place_id` répété, 1 entreprise en double une fois la casse et la ponctuation ignorées |
| Catégories | 21 libellés, mais « Services » à lui seul couvre 51 % du fichier |
| Notes | moyenne 4,67 — dont **34 entreprises à 5,0 sur 3 avis ou moins** |
| Téléphones | 276 présents, 5 hors du format `0X XX XX XX XX` |
| Sites web | 221 présents, 59 encore en `http://` |
| Géolocalisation | 1 entreprise hors de la zone de Marrakech |
| Encodage | fichier UTF-8 **avec BOM** : sans `encoding="utf-8-sig"`, la première colonne devient illisible |

## Étape 2 — Nettoyage et préparation

| Problème détecté | Solution appliquée | Lignes touchées |
|---|---|---|
| Entreprise présente deux fois sous une orthographe différente | déduplication sur `place_id` puis sur le nom normalisé (minuscules, sans ponctuation) | 1 |
| Téléphones en `+212`, `00212`, espacements variables | normalisation en `0X XX XX XX XX`, indicatif marocain reconnu | 1 reformaté, 1 illisible mis à `null` |
| Impossible de savoir qui est joignable sur WhatsApp | indicateur `mobile` (préfixes 06 / 07) | 196 mobiles |
| URLs en `http://`, hôtes en majuscules, slash final | normalisation en `https://`, hôte en minuscules, sans slash | 213 |
| Adresses email invalides ou partagées | validation par expression régulière, indicateur `email_shared` | 0 invalide, 2 adresses partagées |
| `nombre_avis` vide | 0 avis, ce n'est pas une donnée inconnue mais une absence d'avis | 18 |
| Note vide | **laissée vide volontairement** : aucune opinion à imputer | 18 |
| Une note de 5,0 sur 2 avis pèse autant qu'un 4,6 sur 900 | note bayésienne (m-estimate) : `(n·note + 12·moyenne) / (n + 12)` | 34 scores gonflés ramenés vers 4,67 |
| « Services » couvre la moitié du fichier | secteur re-dérivé : le libellé Google est conservé s'il est précis, sinon lecture du nom par règles | 88 entreprises reclassées |
| Coordonnées hors zone | mises à `null` plutôt que supprimées | 1 |

Sortie : `outputs/companies_clean.csv`, 282 lignes × 21 colonnes.

**Choix assumé :** on ne remplace jamais une note manquante par la moyenne. Une note
inventée se propagerait ensuite dans le score d'opportunité et fausserait le
classement des prospects. Un champ vide reste vide et l'entreprise est marquée
`unrated`.

## Étape 3 — Analyse

Le score d'opportunité reprend exactement la formule utilisée par la plateforme
(`app/client/src/lib/scoring.js`) : secteur 30, absence de site 30, joignabilité 15,
volume d'avis 25.

Résultats principaux :

- **Joignabilité** — 97 % ont un téléphone, 70 % un mobile (donc WhatsApp), 78 % un
  site web, mais seulement **50 % une adresse email**.
- **Déficit digital** — 22 % des entreprises n'ont aucun site web ; la proportion
  monte à 50 % chez les consultants.
- **Popularité très asymétrique** — médiane 18 avis, moyenne 281, maximum 6 857 :
  distribution log-normale, une poignée de géants et une longue traîne.
- **Corrélation note / avis : −0,32** — plus une entreprise a d'avis, plus sa note
  baisse. C'est la justification empirique de la note pondérée : les 5,0 parfaits
  viennent d'échantillons minuscules.
- **68 entreprises sur 282 dépassent 65/100** et constituent la cible prioritaire.

## Figures

Toutes dans `outputs/figures/`, fond transparent, palette identique à celle de
l'application.

| Fichier | Contenu |
|---|---|
| `01_missing.png` | valeurs manquantes par colonne |
| `02_categories_raw.png` | déséquilibre des catégories brutes |
| `03_ratings_raw.png` | distribution des notes et notes non fiables |
| `04_completeness.png` | complétude avant / après nettoyage |
| `05_rating_adjustment.png` | effet de la pondération bayésienne |
| `06_funnel.png` | entonnoir de joignabilité |
| `07_digital_gap.png` | absence de site web par secteur |
| `08_reviews_distribution.png` | distribution log-normale des avis |
| `09_score_distribution.png` | répartition du score d'opportunité |
| `10_map.png` | répartition géographique |
