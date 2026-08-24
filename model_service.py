import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional

class MoviePredictionService:
    def __init__(self, model_path: str = 'models/movie_predictor.joblib', metadata_path: str = 'models/dataset_metadata.json', data_path: str = 'models/movies_enhanced.csv'):
        self.model_path = model_path
        self.metadata_path = metadata_path
        self.data_path = data_path
        self.bundle = None
        self.metadata = None
        self.df = None
        self.load()

    def load(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model bundle not found at {self.model_path}. Please run train_model.py first.")
        self.bundle = joblib.load(self.model_path)
        
        with open(self.metadata_path, 'r', encoding='utf-8') as f:
            self.metadata = json.load(f)
            
        self.df = pd.read_csv(self.data_path)
        print("MoviePredictionService loaded successfully.")

    def _extract_features(self, genres: List[str], director: str, actors: List[str], runtime: float, rating: float, metascore: float, votes: int, year: int) -> pd.DataFrame:
        all_genres = self.bundle['all_genres']
        global_rev_mean = self.bundle['global_revenue_mean']
        director_map = self.bundle['director_map']
        actor_map = self.bundle['actor_map']

        genres_set = set([g.strip() for g in genres if g.strip()])
        director_clean = director.strip() if director else ''
        actors_clean = [a.strip() for a in actors if a.strip()]

        row = {}
        for g in all_genres:
            row[f'Genre_{g}'] = 1 if g in genres_set else 0

        row['Runtime (Minutes)'] = float(runtime)
        row['Rating'] = float(rating)
        row['Metascore_Clean'] = float(metascore)
        row['Log_Votes'] = float(np.log1p(votes))
        row['Rating_x_LogVotes'] = float(rating * row['Log_Votes'])
        
        if director_clean in director_map:
            row['Director_Track_Revenue'] = director_map[director_clean]['smoothed_rev']
        else:
            row['Director_Track_Revenue'] = global_rev_mean

        if actors_clean:
            scores = [actor_map.get(a, {}).get('smoothed_rev', global_rev_mean) for a in actors_clean]
            row['Cast_Star_Score'] = float(np.mean(scores))
        else:
            row['Cast_Star_Score'] = global_rev_mean

        row['Genre_Count'] = len(genres_set)
        row['Year'] = int(year)
        row['Metascore_Rating_Ratio'] = float(metascore / (rating * 10 + 1e-5))
        row['Runtime_to_Rating_Ratio'] = float(runtime / (rating + 1e-5))

        feat_cols = self.bundle['feature_cols']
        return pd.DataFrame([row])[feat_cols]

    def predict(self, title: str = '', genres: List[str] = None, director: str = '', actors: List[str] = None, runtime: float = 120, rating: float = 7.0, metascore: float = 60, votes: int = 100000, year: int = 2024) -> Dict[str, Any]:
        if genres is None:
            genres = ['Action']
        if actors is None:
            actors = []
            
        X_df = self._extract_features(genres, director, actors, runtime, rating, metascore, votes, year)
        
        rf_pred = float(self.bundle['rf_regressor'].predict(X_df)[0])
        gbr_pred = float(self.bundle['gbr_regressor'].predict(X_df)[0])
        pred_rev = max(0.0, float(0.5 * rf_pred + 0.5 * gbr_pred))

        error_margin = max(12.0, pred_rev * 0.15 + 10.0)
        ci_lower = max(0.0, round(pred_rev - error_margin, 2))
        ci_upper = round(pred_rev + error_margin, 2)

        cls_model = self.bundle['classifier']
        classes = list(cls_model.classes_)
        probs = cls_model.predict_proba(X_df)[0]
        prob_dict = {cls_name: round(float(prob) * 100, 1) for cls_name, prob in zip(classes, probs)}
        
        if pred_rev >= 150.0:
            tier = 'Blockbuster'
            tier_badge = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        elif pred_rev >= 70.0:
            tier = 'Hit'
            tier_badge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        elif pred_rev >= 25.0:
            tier = 'Moderate'
            tier_badge = 'bg-blue-500/20 text-blue-300 border-blue-500/40'
        else:
            tier = 'Flop / Niche'
            tier_badge = 'bg-rose-500/20 text-rose-300 border-rose-500/40'

        score = min(99.0, max(5.0, (pred_rev / 350.0) * 60.0 + (rating / 10.0) * 30.0 + (metascore / 100.0) * 10.0))

        X_scaled = self.bundle['scaler'].transform(X_df)
        distances, indices = self.bundle['nn_model'].kneighbors(X_scaled, n_neighbors=4)
        
        comparables = []
        for dist, idx in zip(distances[0], indices[0]):
            match_row = self.df.iloc[idx]
            sim_pct = max(10.0, min(99.0, round((1.0 - float(dist)) * 100, 1)))
            comparables.append({
                'title': str(match_row['Title']),
                'year': int(match_row['Year']),
                'genre': str(match_row['Genre']),
                'director': str(match_row['Director']),
                'rating': float(match_row['Rating']),
                'revenue_millions': float(match_row['Revenue (Millions)']),
                'metascore': float(match_row['Metascore']),
                'similarity_pct': sim_pct
            })

        impacts = self._calculate_impacts(genres, director, actors, runtime, rating, metascore, votes, pred_rev)
        verdict = self._generate_verdict(title, pred_rev, tier, genres, director, rating, votes)

        return {
            'title': title or 'Untitled Project',
            'predicted_revenue': round(pred_rev, 2),
            'confidence_interval': {'lower': ci_lower, 'upper': ci_upper},
            'success_tier': tier,
            'tier_badge': tier_badge,
            'tier_probabilities': prob_dict,
            'success_score': round(score, 1),
            'feature_impacts': impacts,
            'comparables': comparables,
            'verdict': verdict,
            'input_summary': {
                'genres': genres,
                'director': director or 'Unknown / Debut',
                'actors': actors or ['Ensemble / Newcomer'],
                'runtime': runtime,
                'rating': rating,
                'metascore': metascore,
                'votes': votes,
                'year': year
            }
        }

    def _calculate_impacts(self, genres: List[str], director: str, actors: List[str], runtime: float, rating: float, metascore: float, votes: int, pred_rev: float) -> List[Dict[str, Any]]:
        impacts = []
        global_mean = self.bundle['global_revenue_mean']

        high_yield_genres = {'Adventure', 'Action', 'Animation', 'Sci-Fi', 'Fantasy'}
        low_yield_genres = {'Horror', 'Romance', 'Drama', 'Mystery', 'Music', 'History'}
        present_high = [g for g in genres if g in high_yield_genres]
        present_low = [g for g in genres if g in low_yield_genres]
        
        if present_high:
            impacts.append({
                'factor': f'High-Yield Genres ({", ".join(present_high)})',
                'impact': 'positive',
                'description': 'Commercial blockbuster genres with major theatrical turnout and global scale.',
                'magnitude': 'High (+)'
            })
        elif present_low:
            impacts.append({
                'factor': f'Targeted Genres ({", ".join(present_low)})',
                'impact': 'neutral',
                'description': 'Genre skews towards specific audience demographics or lower production budgets.',
                'magnitude': 'Moderate'
            })

        d_clean = director.strip() if director else ''
        if d_clean in self.bundle['director_map']:
            d_info = self.bundle['director_map'][d_clean]
            if d_info['avg_revenue'] > global_mean * 1.2:
                impacts.append({
                    'factor': f'Director Box Office Track ({d_clean})',
                    'impact': 'positive',
                    'description': f'Historical gross avg of ${d_info["avg_revenue"]:.1f}M across {d_info["count"]} films.',
                    'magnitude': 'Very High (+)'
                })
            elif d_info['avg_revenue'] < global_mean * 0.7:
                impacts.append({
                    'factor': f'Director Track Record ({d_clean})',
                    'impact': 'negative',
                    'description': f'Past track record averaged ${d_info["avg_revenue"]:.1f}M in theatrical revenue.',
                    'magnitude': 'Moderate (-)'
                })

        top_cast_found = [a for a in actors if a.strip() in self.bundle['actor_map'] and self.bundle['actor_map'][a.strip()]['avg_revenue'] > 110]
        if top_cast_found:
            impacts.append({
                'factor': f'Star Power Cast ({", ".join(top_cast_found[:2])})',
                'impact': 'positive',
                'description': 'Established headliners proven to accelerate opening weekend grosses.',
                'magnitude': 'High (+)'
            })

        if votes >= 300000:
            impacts.append({
                'factor': 'High Audience Reach & Word-of-Mouth',
                'impact': 'positive',
                'description': f'Over {votes:,} projected votes indicating high organic engagement.',
                'magnitude': 'Very High (+)'
            })
        elif votes < 35000:
            impacts.append({
                'factor': 'Moderate / Niche Anticipation',
                'impact': 'negative',
                'description': 'Lower broad public awareness limits total theatrical footprint.',
                'magnitude': 'Moderate (-)'
            })

        if rating >= 7.8 and metascore >= 70:
            impacts.append({
                'factor': f'Critical & Audience Acclaim ({rating}/10, Meta {metascore})',
                'impact': 'positive',
                'description': 'Strong critical consensus prolongs theatrical box office run.',
                'magnitude': 'Moderate (+)'
            })
        elif rating < 6.0:
            impacts.append({
                'factor': f'Sub-6.0 Audience Reception ({rating}/10)',
                'impact': 'negative',
                'description': 'Subdued reviews dampen word-of-mouth after opening weekend.',
                'magnitude': 'High (-)'
            })

        return impacts[:5]

    def _generate_verdict(self, title: str, pred_rev: float, tier: str, genres: List[str], director: str, rating: float, votes: int) -> str:
        name = f'"{title}"' if title else 'This production'
        genre_str = '/'.join(genres) if genres else 'film'
        
        if tier == 'Blockbuster':
            return f'{name} is projected as a Tier-1 Blockbuster with estimated theatrical gross of ~${pred_rev:.1f}M. The potent synergy of {genre_str} appeal and high audience anticipation signals major global box office momentum.'
        elif tier == 'Hit':
            return f'{name} demonstrates strong commercial fundamentals as a solid Hit, projected at ~${pred_rev:.1f}M. Healthy audience interest and genre performance ensure robust profitability.'
        elif tier == 'Moderate':
            return f'{name} is forecasted for Moderate theatrical performance (~${pred_rev:.1f}M). Suitable for focused demographic appeal with secondary streaming revenues driving lifetime returns.'
        else:
            return f'{name} is projected into the Niche/Independent tier (~${pred_rev:.1f}M). Recommended strategy is lean production budgets or targeted platform release to maximize ROI.'

    def what_if(self, base_input: Dict[str, Any], variations: Dict[str, Any]) -> Dict[str, Any]:
        base_pred = self.predict(**base_input)
        
        simulated_input = dict(base_input)
        for k, v in variations.items():
            simulated_input[k] = v
            
        sim_pred = self.predict(**simulated_input)
        
        delta_rev = round(sim_pred['predicted_revenue'] - base_pred['predicted_revenue'], 2)
        pct_change = round((delta_rev / (base_pred['predicted_revenue'] + 1e-5)) * 100, 1)

        return {
            'base_prediction': base_pred,
            'simulated_prediction': sim_pred,
            'delta_revenue': delta_rev,
            'percentage_change': pct_change,
            'variations_applied': variations
        }

    def search_movies(self, query: str = '', genre: str = '', sort_by: str = 'Revenue (Millions)', sort_order: str = 'desc', page: int = 1, per_page: int = 12) -> Dict[str, Any]:
        df_filtered = self.df.copy()
        
        if query:
            q = query.lower().strip()
            df_filtered = df_filtered[
                df_filtered['Title'].str.lower().str.contains(q, na=False) |
                df_filtered['Director'].str.lower().str.contains(q, na=False) |
                df_filtered['Actors'].str.lower().str.contains(q, na=False)
            ]

        if genre and genre != 'All':
            df_filtered = df_filtered[df_filtered['Genre'].str.contains(genre, na=False, case=False)]

        if sort_by in df_filtered.columns:
            ascending = (sort_order.lower() == 'asc')
            df_filtered = df_filtered.sort_values(by=sort_by, ascending=ascending)

        total_count = len(df_filtered)
        start = (page - 1) * per_page
        end = start + per_page
        page_items = df_filtered.iloc[start:end].to_dict(orient='records')

        return {
            'total': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': int(np.ceil(total_count / per_page)) if total_count > 0 else 1,
            'movies': page_items
        }

    def get_stats_data(self) -> Dict[str, Any]:
        return self.metadata

if __name__ == '__main__':
    svc = MoviePredictionService()
    p = svc.predict(title="Inception 2", genres=["Action", "Sci-Fi", "Thriller"], director="Christopher Nolan", actors=["Leonardo DiCaprio", "Joseph Gordon-Levitt"], runtime=148, rating=8.8, metascore=74, votes=1200000)
    print("Test prediction:", p['title'], p['predicted_revenue'], p['success_tier'])
