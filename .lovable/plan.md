

## Fix: Add "Add-On" (and align Feature Levels) in the Overview Tab

### Problem
When editing a feature in the Feature Detail drawer's **Overview** tab, the "Feature Level" dropdown only shows: Core, Enhancement, Experiment, Bugfix. This is out of sync with the rest of the app (NewFeatureDrawer, BacklogList, filters) which correctly shows: Core, Integrations, Add-On.

### Solution
Update the `FEATURE_LEVELS` constant in `src/components/roadmap/feature-detail/OverviewTab.tsx` (line 39) to match the canonical set used everywhere else:

**From:**
```
['Core', 'Enhancement', 'Experiment', 'Bugfix']
```

**To:**
```
['Core', 'Integrations', 'Add-On']
```

This is a single-line change in one file. No database changes needed since `feature_level` is a free-text column.

### File Changed
| File | Change |
|------|--------|
| `src/components/roadmap/feature-detail/OverviewTab.tsx` | Update `FEATURE_LEVELS` array to `['Core', 'Integrations', 'Add-On']` |

