import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware

model = joblib.load("Mental_Health_Model.pkl")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


# Pydantic model for validating input data
class StudentData(BaseModel):
    age                     : int = Field(..., ge=10, le=100)
    gender                  : Literal['Male', 'Female']
    country                 : str
    academic_level          : Literal['Undergraduate', 'Graduate', 'High School']
    most_used_platform      : Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat','Twitter','YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp','WeChat']
    purpose_of_use          : Literal['Networking', 'Education', 'Entertainment', 'News']
    avg_daily_usage_hours   : float = Field(..., ge=0, le=24)
    daily_unlocks           : int   = Field(..., ge=0)
    study_hours             : float = Field(..., ge=0, le=24)
    physical_activity_hours : float = Field(..., ge=0, le=24)
    sleep_hours_per_night   : float = Field(..., ge=0, le=24)
    stress_level            : Literal['Medium', 'Low', 'Very High', 'High']

# Pydantic model for validating output data
class PredictionResponse(BaseModel):
    predicted_mental_health_score:float

@app.get("/")
def greet():
    return {"message": "Hello, World!"}


@app.post("/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    top_countries = ['Other','Canada','USA','India','Australia','UK','Germany','France','Mexico','Turkey'] # Example list of countries

    country = data.country if data.country in top_countries else 'Other'
    input_row = pd.DataFrame([
        {
            'Age': data.age,
            'Gender': data.gender,
            'Country': country,
            'Academic_Level': data.academic_level,
            'Most_Used_Platform': data.most_used_platform,
            'Purpose_Of_Use': data.purpose_of_use,
            'Sleep_Hours_Per_Night': data.sleep_hours_per_night,
            'Daily_Unlocks': data.daily_unlocks,
            'Study_Hours': data.study_hours,
            'Physical_Activity_Hours': data.physical_activity_hours,
            'Avg_Daily_Usage_Hours': data.avg_daily_usage_hours,
            'Stress_Level': data.stress_level
            
        }
    ])

    prediction = model.predict(input_row)
    score = round(float(prediction[0]), 2)
    return PredictionResponse(predicted_mental_health_score=score)