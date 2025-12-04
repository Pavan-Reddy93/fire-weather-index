

import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os
import logging

logging.basicConfig(level=logging.INFO)

# --- 1. Configuration ---
dataset_filename = 'Algerian_forest_fires_dataset_UPDATE.csv' # Ensure this matches your downloaded file
FEATURES = ['Temperature', 'RH', 'Ws', 'Rain', 'FFMC', 'DMC', 'DC', 'ISI']
TARGET = 'FWI'
PHYSICS_FEATURES_INDICES = {'Temperature': 0, 'RH': 1, 'Ws': 2, 'Rain': 3}
N_EPOCHS = 100
BATCH_SIZE = 32
PHYSICS_LOSS_WEIGHT = 0.1

# --- 2. Load and Prepare Data ---
try:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(base_dir, dataset_filename)

   
    df = pd.read_csv(dataset_path, header=1, skiprows=[125])
    logging.info(f"Successfully loaded '{dataset_filename}'.")

    df.columns = df.columns.str.strip()
    split_index = df[pd.to_numeric(df['day'], errors='coerce').isna()].index
    if len(split_index) > 0:
        split_row = split_index[0]
        df['Region'] = 0
        df.loc[split_row:, 'Region'] = 1
        df = df.drop(split_index)
    else:
        df['Region'] = 0
        logging.warning("Mid-file header not found, assuming single region dataset.")

    columns_to_drop = ['day', 'month', 'year', 'Classes', 'Region']
    df = df.drop(columns=[col for col in columns_to_drop if col in df.columns], errors='ignore')

    numeric_cols = FEATURES + [TARGET]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        else:
            logging.error(f"Column '{col}' expected but not found after cleaning. Check FEATURES list. Exiting.")
            exit()

    initial_rows = len(df)
    df.dropna(subset=numeric_cols, inplace=True)
    dropped_rows = initial_rows - len(df)
    if dropped_rows > 0:
        logging.warning(f"Dropped {dropped_rows} rows containing NaN values after numeric conversion.")
    df.reset_index(drop=True, inplace=True)

    X = df[FEATURES].astype(np.float32)
    y = df[TARGET].astype(np.float32).values.reshape(-1, 1)

    if len(X) == 0:
        logging.error("No valid data remaining after cleaning. Check CSV format and column names. Exiting.")
        exit()

    logging.info(f"Data cleaned and prepared with {len(X)} samples.")

except FileNotFoundError:
    logging.error(f"Could not find dataset '{dataset_filename}' in '{base_dir}'. Exiting.")
    exit()
except Exception as e:
    logging.error(f"Error processing the dataset: {e}", exc_info=True)
    exit()

# --- 3. Split and Scale Data ---
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)
train_dataset = tf.data.Dataset.from_tensor_slices((X_train_scaled, y_train)).shuffle(len(X_train)).batch(BATCH_SIZE)
test_dataset = tf.data.Dataset.from_tensor_slices((X_test_scaled, y_test)).batch(BATCH_SIZE)
logging.info("Data split, scaled, and converted to TensorFlow datasets.")

# --- 4. Build the Neural Network Model ---
model = tf.keras.models.Sequential([
    tf.keras.layers.Dense(128, activation='relu', input_shape=(len(FEATURES),)),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dense(1)
])
model.summary()

# --- 5. Define Loss Functions & Optimizer ---
optimizer = tf.keras.optimizers.Adam()
mse_loss_fn = tf.keras.losses.MeanSquaredError()

def physics_loss_fn(model, x_batch):
    with tf.GradientTape() as tape:
        tape.watch(x_batch)
        y_pred = model(x_batch, training=True)
    gradients = tape.gradient(y_pred, x_batch)
    if gradients is None: return tf.constant(0.0, dtype=tf.float32)

    grad_temp = gradients[:, PHYSICS_FEATURES_INDICES['Temperature']]
    grad_rh = gradients[:, PHYSICS_FEATURES_INDICES['RH']]
    grad_ws = gradients[:, PHYSICS_FEATURES_INDICES['Ws']]
    grad_rain = gradients[:, PHYSICS_FEATURES_INDICES['Rain']]

    loss_temp = tf.reduce_mean(tf.maximum(0., -grad_temp))
    loss_rh = tf.reduce_mean(tf.maximum(0., grad_rh))
    loss_ws = tf.reduce_mean(tf.maximum(0., -grad_ws))
    loss_rain = tf.reduce_mean(tf.maximum(0., grad_rain))
    return loss_temp + loss_rh + loss_ws + loss_rain

# --- 6. Custom Training Step ---
@tf.function
def train_step(x_batch, y_batch):
    with tf.GradientTape() as tape:
        y_pred = model(x_batch, training=True)
        data_loss = mse_loss_fn(y_batch, y_pred)
        physics_loss = physics_loss_fn(model, x_batch)
        total_loss = data_loss + PHYSICS_LOSS_WEIGHT * physics_loss
    gradients = tape.gradient(total_loss, model.trainable_variables)
    optimizer.apply_gradients(zip(gradients, model.trainable_variables))
    return data_loss, physics_loss, total_loss

# --- 7. Custom Training Loop ---
logging.info("--- Starting PINN Training ---")
for epoch in range(N_EPOCHS):
    epoch_data_loss_avg = tf.keras.metrics.Mean()
    epoch_physics_loss_avg = tf.keras.metrics.Mean()
    epoch_total_loss_avg = tf.keras.metrics.Mean()
    for x_batch, y_batch in train_dataset:
        data_loss, physics_loss, total_loss = train_step(x_batch, y_batch)
        epoch_data_loss_avg.update_state(data_loss)
        epoch_physics_loss_avg.update_state(physics_loss)
        epoch_total_loss_avg.update_state(total_loss)
    # Print progress every 10 epochs
    if (epoch + 1) % 10 == 0 or epoch == N_EPOCHS - 1:
        print(f"Epoch {epoch+1}/{N_EPOCHS} - Data Loss: {epoch_data_loss_avg.result():.4f}, Physics Loss: {epoch_physics_loss_avg.result():.4f}, Total Loss: {epoch_total_loss_avg.result():.4f}")
logging.info("--- PINN Training Finished ---\n")

# --- 8. Evaluate the Model ---
logging.info("--- Evaluating Model on Test Data ---")
model.compile(optimizer='adam', loss='mean_squared_error')
test_loss = model.evaluate(X_test_scaled, y_test, verbose=0)
print(f"Final Test Loss (Mean Squared Error): {test_loss:.4f}")
print("-------------------------------------\n")

# --- 9. Save the Trained Model and Scaler ---
scaler_filename = 'scaler_pinn.pkl'
model_filename = 'fwi_pinn_model.keras'
base_dir = os.path.dirname(os.path.abspath(__file__))
scaler_path = os.path.join(base_dir, scaler_filename)
model_path = os.path.join(base_dir, model_filename)

with open(scaler_path, 'wb') as f:
    pickle.dump(scaler, f)
logging.info(f"Scaler saved to: {scaler_path}")

model.save(model_path)
logging.info(f"PINN model saved to: {model_path}")
print("\n--- All files saved successfully! You can now run app.py again. ---\n")
