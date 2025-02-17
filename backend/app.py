from fastapi import FastAPI,  UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from utils import *

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str
    chat_context: list[dict]

class FollowRequest(BaseModel):
    current_text: str

@app.post("/process-pdf")
async def process_pdf(file: UploadFile = File(...)):
    try:
        pdf_path = f"temp_{file.filename}"
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(await file.read())
        
        texts, metadata = extract_text_from_pdf(pdf_path)
        cleaned_texts = [clean_text(text) for text in texts]
        create_faiss_index(cleaned_texts, metadata)
        extract_images_from_pdf(pdf_path)
        
        os.remove(pdf_path)
        
        return {
            "status": "success",
            "message": "PDF processed successfully",
            "chunks": len(texts),
            "images": len([f for f in os.listdir("images") if f.endswith((".png", ".jpg", ".jpeg"))])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        is_image_query = is_image_related_query(request.question)
        
        if is_image_query:
            pattern = r'\b(?:page|on page)\s*(\d+)\b'
            match = re.search(pattern, request.question, re.IGNORECASE)
            if match:
                relevant_page = [int(match.group(1))]
                relevant_image = await get_relevant_images(relevant_page)
                
                if relevant_image:
                    for img in relevant_image:
                        analysis = await analyze_image_with_gemini(
                            img["file_path"],
                            f"Analyze this image and answer: {request.question}"
                        )
                        image_analyses = {
                            "page": img["page"],
                            "message": analysis,
                            "image_path": img["file_path"]
                        }
                    return image_analyses
                else:
                    return {"message": "No relevant images found for the page number."}
            else:
                return {"message": "No page number found in the query."}

        else:
            relevant_chunks = await search_similar_chunks(request.question)
            relevant_pages = list(set(chunk["page"] for chunk in relevant_chunks))

            context = "\n".join([chunk["text"] for chunk in relevant_chunks])
            prompt = f"""You are a knowledgeable and encouraging teacher having a conversation with a student.

            Previous conversation:
            {request.chat_context}

            Remember this info about the book while querying anything that the user asks. NO NEED TO TALK ABOUT THE CONTEXT IF THE USER ASKS SOMETHING FROM THE HISTORY

            Some relevant information from the document is below:
            ---------------------
            {context}
            ---------------------

            The student asks: {request.question}

            As their teacher:
            1. If the question can be answered using the provided context, use that information and cite specific pages using (p. X) format
            2. If the question requires general knowledge, you may draw from your broader understanding to provide accurate information
            3. If you need to combine both document context and general knowledge, do so thoughtfully
            4. If the question would be better answered with different sections of the document, mention that

            Guidelines:
            - Be clear, concise, and educational
            - Use examples or analogies when helpful
            - Break down complex ideas
            - Stay accurate and relevant
            - Be encouraging and supportive
            - Keep responses focused and thorough

            Provide a helpful response that best serves the student's learning."""
            
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that answers questions based only on the provided context."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            return {
                "message": response.choices[0].message.content,
                "relevant_pages": relevant_pages,
                "source_chunks": relevant_chunks
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-followup")
async def generate_follow_up_questions(request: FollowRequest ) -> List[str]:
    prompt = f"""Based on the context and the current question: "{request.current_text}", 
    suggest 3 relevant follow-up questions that would help explore the topic further.
    Format them as a Python list of strings. NOTHING ELSE JUST 3 COMMA SEPERATED QUESTIONS IN SQUARE BRACKETS. 
    
    Follow this Format strictly:
    ['q1','q2','q3']

    NO line changes. Return a single line list NOTHING ELSE.
    """
    
    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Generate relevant follow-up questions based on the context and current question."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=200
    )
    
    try:
        questions = eval(response.choices[0].message.content)
        print(questions)
        return questions if isinstance(questions, list) else []
    except:
        return []
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", reload=True, port=8080)