# Version

Versions allow multiple snapshots of records over time.  In a given data set, only one version of any given column can be a fact at a given time.  Over time, as that column changes new snapshots of the column are created.  Snapshots can also be made at the record or comprehension-level.  The larger the scope of the snapshot, the lower the implicit confidence in the data.