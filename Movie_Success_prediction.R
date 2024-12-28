# Loading of the necessary libraries
library(tidyverse)
library(caret)
library(randomForest)

# Loading the dataset
file_path <- '~/dataSciences/movies.csv'
data <- read.csv(file_path)

# Data Cleaning
# Fill missing values for 'Revenue (Millions)' and 'Metascore' with their mean values
data$Revenue..Millions.[is.na(data$Revenue..Millions.)] <- mean(data$Revenue..Millions., na.rm = TRUE)
data$Metascore[is.na(data$Metascore)] <- mean(data$Metascore, na.rm = TRUE)

# Feature Engineering
# Extract main genre from 'Genre'
data$Main.Genre <- sapply(strsplit(as.character(data$Genre), ","), `[`, 1)

# Simplify 'Director' and 'Actors' to count of words (indicating popularity measure)
data$Director.Popularity <- sapply(strsplit(as.character(data$Director), " "), length)
data$Actor.Popularity <- sapply(strsplit(as.character(data$Actors), ","), length)

# Select relevant features
features <- c("Main.Genre", "Runtime..Minutes.", "Rating", "Votes", "Metascore", "Director.Popularity", "Actor.Popularity")
X <- data[features]
y <- data$Revenue..Millions.

# One-Hot Encoding for 'Main.Genre'
X <- X %>% mutate(across(Main.Genre, as.factor))
X <- model.matrix(~ . - 1, data = X) %>% as.data.frame()

# Train-Test Split
set.seed(42)
train_index <- createDataPartition(y, p = 0.8, list = FALSE)
X_train <- X[train_index, ]
X_test <- X[-train_index, ]
y_train <- y[train_index]
y_test <- y[-train_index]

# Model Building
rf_model <- randomForest(X_train, y_train, ntree = 100, importance = TRUE)

# Predictions
y_pred <- predict(rf_model, X_test)

# Model Evaluation
mse <- mean((y_test - y_pred)^2)
r2 <- 1 - sum((y_test - y_pred)^2) / sum((y_test - mean(y_test))^2)

cat("Mean Squared Error (MSE):", mse, "\n")
cat("R-squared (R2):", r2, "\n")

# Feature Importance
importance <- importance(rf_model)
importance_df <- data.frame(Feature = rownames(importance), Importance = importance[, 1]) %>% arrange(desc(Importance))

# Plot Feature Importance
ggplot(importance_df, aes(x = reorder(Feature, Importance), y = Importance)) +
  geom_bar(stat = "identity") +
  coord_flip() +
  labs(title = "Feature Importance", x = "Feature", y = "Importance")

# Visualization: Revenue vs. Genre
ggplot(data, aes(x = Main.Genre, y = Revenue..Millions.)) +
  geom_boxplot() +
  labs(title = "Revenue by Main Genre", x = "Main Genre", y = "Revenue (Millions)") +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

# Save the processed dataset
processed_file_path <- '~/dataSciences/movies_processed.csv'
write.csv(data, processed_file_path, row.names = FALSE)
cat("Processed dataset saved to", processed_file_path, "\n")


