import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error, classification_report, accuracy_score

def train():
    print('Loading dataset...')
    csv_path = 'movies.csv'
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'Dataset not found at {csv_path}')
    
    df = pd.read_csv(csv_path)
    print(f'Raw dataset shape: {df.shape}')

    # Impute missing values with dataset means
    mean_revenue = float(df['Revenue (Millions)'].mean())
    mean_metascore = float(df['Metascore'].mean())

    df['Revenue_Clean'] = df['Revenue (Millions)'].fillna(mean_revenue)
    df['Metascore_Clean'] = df['Metascore'].fillna(mean_metascore)

    # 1. Unique Genres Extraction
    all_genres = sorted(list(set([g.strip() for sublist in df['Genre'].dropna().str.split(',') for g in sublist])))
    print(f'Identified {len(all_genres)} genres: {all_genres}')

    for g in all_genres:
        df[f'Genre_{g}'] = df['Genre'].apply(lambda x: 1 if pd.notna(x) and g in [i.strip() for i in str(x).split(',')] else 0)

    df['Main_Genre'] = df['Genre'].apply(lambda x: str(x).split(',')[0].strip() if pd.notna(x) else 'Unknown')
    df['Genre_Count'] = df['Genre'].apply(lambda x: len(str(x).split(',')) if pd.notna(x) else 0)

    # 2. Empirical Bayesian Prior Smoothing for Directors
    m = 2.0  # smoothing prior weight
    global_revenue_mean = float(df['Revenue_Clean'].mean())
    global_rating_mean = float(df['Rating'].mean())

    director_stats = df.groupby('Director').agg(
        movie_count=('Title', 'count'),
        avg_revenue=('Revenue_Clean', 'mean'),
        avg_rating=('Rating', 'mean')
    )

    director_map = {}
    for d, row in director_stats.iterrows():
        cnt = row['movie_count']
        smoothed_rev = (cnt * row['avg_revenue'] + m * global_revenue_mean) / (cnt + m)
        director_map[d] = {
            'count': int(cnt),
            'smoothed_rev': float(smoothed_rev),
            'avg_revenue': float(row['avg_revenue']),
            'avg_rating': float(row['avg_rating'])
        }

    df['Director_Track_Revenue'] = df['Director'].apply(lambda d: director_map.get(d, {}).get('smoothed_rev', global_revenue_mean))

    # 3. Actor Star Power Score with Bayesian Smoothing
    actor_revenues = {}
    actor_ratings = {}
    for _, row in df.iterrows():
        actors = [a.strip() for a in str(row['Actors']).split(',') if a.strip()]
        for a in actors:
            actor_revenues.setdefault(a, []).append(row['Revenue_Clean'])
            actor_ratings.setdefault(a, []).append(row['Rating'])

    actor_map = {}
    for a, revs in actor_revenues.items():
        cnt = len(revs)
        smoothed_rev = (cnt * np.mean(revs) + m * global_revenue_mean) / (cnt + m)
        actor_map[a] = {
            'count': int(cnt),
            'smoothed_rev': float(smoothed_rev),
            'avg_revenue': float(np.mean(revs)),
            'avg_rating': float(np.mean(actor_ratings[a]))
        }

    def get_cast_star_score(actor_str):
        if pd.isna(actor_str):
            return global_revenue_mean
        actors = [a.strip() for a in str(actor_str).split(',') if a.strip()]
        if not actors:
            return global_revenue_mean
        scores = [actor_map.get(a, {}).get('smoothed_rev', global_revenue_mean) for a in actors]
        return float(np.mean(scores))

    df['Cast_Star_Score'] = df['Actors'].apply(get_cast_star_score)

    # 4. Engineered Statistical Features
    df['Log_Votes'] = np.log1p(df['Votes'])
    df['Rating_x_LogVotes'] = df['Rating'] * df['Log_Votes']
    df['Metascore_Rating_Ratio'] = df['Metascore_Clean'] / (df['Rating'] * 10 + 1e-5)
    df['Runtime_to_Rating_Ratio'] = df['Runtime (Minutes)'] / (df['Rating'] + 1e-5)

    # 5. Success Tier Classification Target
    def categorize_success(rev):
        if rev >= 150.0:
            return 'Blockbuster'
        elif rev >= 70.0:
            return 'Hit'
        elif rev >= 25.0:
            return 'Moderate'
        else:
            return 'Flop / Niche'

    df['Success_Tier'] = df['Revenue_Clean'].apply(categorize_success)

    # 6. Feature Selection
    genre_feature_cols = [f'Genre_{g}' for g in all_genres]
    numerical_feature_cols = [
        'Runtime (Minutes)',
        'Rating',
        'Metascore_Clean',
        'Log_Votes',
        'Rating_x_LogVotes',
        'Director_Track_Revenue',
        'Cast_Star_Score',
        'Genre_Count',
        'Year',
        'Metascore_Rating_Ratio',
        'Runtime_to_Rating_Ratio'
    ]
    feature_cols = genre_feature_cols + numerical_feature_cols

    X = df[feature_cols]
    y_reg = df['Revenue_Clean']
    y_cls = df['Success_Tier']

    # Train / Test Split
    X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test = train_test_split(
        X, y_reg, y_cls, test_size=0.2, random_state=42, stratify=y_cls
    )

    print(f'Training on {len(X_train)} samples, testing on {len(X_test)} samples...')

    # Regression Models
    rf_reg = RandomForestRegressor(n_estimators=150, max_depth=12, min_samples_split=4, random_state=42, n_jobs=-1)
    rf_reg.fit(X_train, y_reg_train)
    y_pred_rf = rf_reg.predict(X_test)

    gbr_reg = GradientBoostingRegressor(n_estimators=120, max_depth=4, learning_rate=0.08, random_state=42)
    gbr_reg.fit(X_train, y_reg_train)
    y_pred_gbr = gbr_reg.predict(X_test)

    # Ensemble Prediction
    y_pred_ens = 0.5 * y_pred_rf + 0.5 * y_pred_gbr
    r2 = float(r2_score(y_reg_test, y_pred_ens))
    rmse = float(np.sqrt(mean_squared_error(y_reg_test, y_pred_ens)))
    mae = float(mean_absolute_error(y_reg_test, y_pred_ens))

    print(f'Ensemble Regressor Metrics -> R2: {r2:.4f}, RMSE: M, MAE: M')

    # Classification Model
    cls_model = GradientBoostingClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    cls_model.fit(X_train, y_cls_train)
    y_cls_pred = cls_model.predict(X_test)
    cls_acc = float(accuracy_score(y_cls_test, y_cls_pred))
    cls_report = classification_report(y_cls_test, y_cls_pred, output_dict=True)
    print(f'Classifier Accuracy: {cls_acc*100:.2f}%')

    # Nearest Neighbors Matcher for Comparable Movies
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    nn_model = NearestNeighbors(n_neighbors=8, metric='cosine')
    nn_model.fit(X_scaled)

    # Feature Importance Computation
    importances = 0.5 * rf_reg.feature_importances_ + 0.5 * gbr_reg.feature_importances_
    feat_imp = sorted([
        {'feature': col.replace('Genre_', 'Genre: ').replace('_Clean', '').replace('_', ' '), 'importance': round(float(imp) * 100, 2)}
        for col, imp in zip(feature_cols, importances)
    ], key=lambda x: x['importance'], reverse=True)

    # Precompute Genre Statistics
    genre_stats = []
    for g in all_genres:
        g_mask = df[f'Genre_{g}'] == 1
        sub = df[g_mask]
        genre_stats.append({
            'genre': g,
            'count': int(len(sub)),
            'avg_revenue': round(float(sub['Revenue_Clean'].mean()), 2),
            'avg_rating': round(float(sub['Rating'].mean()), 2),
            'avg_metascore': round(float(sub['Metascore_Clean'].mean()), 2),
            'avg_votes': int(sub['Votes'].mean())
        })
    genre_stats.sort(key=lambda x: x['avg_revenue'], reverse=True)

    # Precompute Top Directors
    top_directors = []
    for d, info in director_map.items():
        if info['count'] >= 1:
            top_directors.append({
                'name': d,
                'movie_count': info['count'],
                'avg_revenue': round(info['avg_revenue'], 2),
                'avg_rating': round(info['avg_rating'], 2)
            })
    top_directors.sort(key=lambda x: (x['movie_count'], x['avg_revenue']), reverse=True)

    # Precompute Top Actors
    top_actors = []
    for a, info in actor_map.items():
        top_actors.append({
            'name': a,
            'movie_count': info['count'],
            'avg_revenue': round(info['avg_revenue'], 2),
            'avg_rating': round(info['avg_rating'], 2)
        })
    top_actors.sort(key=lambda x: (x['movie_count'], x['avg_revenue']), reverse=True)

    # Ensure models directory exists
    os.makedirs('models', exist_ok=True)

    # Save Models Bundle
    bundle = {
        'rf_regressor': rf_reg,
        'gbr_regressor': gbr_reg,
        'classifier': cls_model,
        'nn_model': nn_model,
        'scaler': scaler,
        'feature_cols': feature_cols,
        'all_genres': all_genres,
        'numerical_feature_cols': numerical_feature_cols,
        'global_revenue_mean': global_revenue_mean,
        'global_rating_mean': global_rating_mean,
        'mean_metascore': mean_metascore,
        'director_map': director_map,
        'actor_map': actor_map,
        'classes': list(cls_model.classes_)
    }
    joblib.dump(bundle, 'models/movie_predictor.joblib')
    print('Model bundle saved to models/movie_predictor.joblib')

    # Save Metadata JSON for frontend and stats
    metadata = {
        'total_movies': int(len(df)),
        'global_mean_revenue': round(global_revenue_mean, 2),
        'global_mean_rating': round(global_rating_mean, 2),
        'global_mean_metascore': round(mean_metascore, 2),
        'global_mean_runtime': round(float(df['Runtime (Minutes)'].mean()), 1),
        'global_mean_votes': int(df['Votes'].mean()),
        'all_genres': all_genres,
        'genre_stats': genre_stats,
        'top_directors': top_directors[:60],
        'top_actors': top_actors[:100],
        'feature_importances': feat_imp,
        'model_metrics': {
            'r2_score': round(r2, 4),
            'rmse_millions': round(rmse, 2),
            'mae_millions': round(mae, 2),
            'classifier_accuracy': round(cls_acc * 100, 2),
            'rf_r2': round(float(r2_score(y_reg_test, y_pred_rf)), 4),
            'gbr_r2': round(float(r2_score(y_reg_test, y_pred_gbr)), 4),
            'test_samples': len(X_test),
            'train_samples': len(X_train)
        },
        'tier_distribution': {
            k: int(v) for k, v in df['Success_Tier'].value_counts().to_dict().items()
        }
    }

    with open('models/dataset_metadata.json', 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    print('Metadata saved to models/dataset_metadata.json')

    # Also save clean dataset with all processed fields for quick querying
    df_export = df[['Rank', 'Title', 'Genre', 'Director', 'Actors', 'Year', 'Runtime (Minutes)', 'Rating', 'Votes', 'Revenue_Clean', 'Metascore_Clean', 'Success_Tier', 'Description']]
    df_export.rename(columns={'Revenue_Clean': 'Revenue (Millions)', 'Metascore_Clean': 'Metascore'}, inplace=True)
    df_export.to_csv('models/movies_enhanced.csv', index=False)
    print('Enhanced dataset saved to models/movies_enhanced.csv')
    print('Training process completed successfully!')

if __name__ == '__main__':
    train()
