import os
import json
import fitz
import faiss
import numpy as np
import tiktoken
import openai
import PIL.Image
import re
from google import genai
from typing import List
import re
from dotenv import load_dotenv

load_dotenv()

openai.api_key = os.getenv('OPENAI_API_KEY')
gemini_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
tokenizer = tiktoken.get_encoding("cl100k_base")

def clean_text(text):
    text = re.sub(r'[^\x20-\x7E]', '', text)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

def chunk_text(text, max_tokens=512):
    tokens = tokenizer.encode(text)
    chunks = [tokens[i : i + max_tokens] for i in range(0, len(tokens), max_tokens)]
    return [tokenizer.decode(chunk) for chunk in chunks]

def extract_text_from_pdf(pdf_path, max_tokens=512):
    doc = fitz.open(pdf_path)
    texts = []
    metadata = []
    
    for page_num in range(len(doc)):
        text = doc[page_num].get_text("text")
        if text.strip():
            text_chunks = chunk_text(text, max_tokens)
            for chunk in text_chunks:
                texts.append(chunk)
                metadata.append({"page": page_num + 1, "text": chunk})
    
    return texts, metadata

def get_openai_embeddings(texts):
    response = openai.embeddings.create(input=texts, model="text-embedding-ada-002")
    return np.array([d.embedding for d in response.data], dtype=np.float32)

def create_faiss_index(texts, metadata, index_path="faiss_index"):
    embeddings = get_openai_embeddings(texts)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    
    index.add(embeddings)
    faiss.write_index(index, index_path)
    
    with open("metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)

def extract_images_from_pdf(pdf_path):
    os.makedirs("images", exist_ok=True)
    
    doc = fitz.open(pdf_path)
    images_info = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)
        
        for img_index, img in enumerate(images):
            xref = img[0]
            base_image = doc.extract_image(xref)
            img_bytes = base_image["image"]
            img_ext = base_image["ext"]
            
            img_filename = f"page_{page_num + 1}_img_{img_index + 1}.{img_ext}"
            img_path = os.path.join("images", img_filename)
            
            with open(img_path, "wb") as img_file:
                img_file.write(img_bytes)
                
            images_info.append({"page": page_num + 1,"file_path": img_path})

    json_path = os.path.join("images", "images.json")
    with open(json_path, "w") as json_file:
        json.dump(images_info, json_file, indent=4)

async def search_similar_chunks(question, top_k: int = 5):
    index = faiss.read_index("faiss_index")
    
    question_embedding = get_openai_embeddings([question])
    _, I = index.search(question_embedding, top_k)
    
    with open("metadata.json", "r") as f:
        metadata = json.load(f)
    
    relevant_chunks = [metadata[i] for i in I[0]]
    return relevant_chunks

def is_image_related_query(question):
    image_related_terms = [
        r'image', r'picture', r'figure', r'diagram', r'photo', r'illustration',
        r'what does .* show', r'what is shown', r'what appears', r'what can you see'
    ]
    pattern = '|'.join(image_related_terms)
    return bool(re.search(pattern, question.lower()))

async def analyze_image_with_gemini(image_path, question):
    try:
        image = PIL.Image.open(image_path)
        
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[question, image]
        )
        return response.text
    except Exception as e:
        raise Exception(f"Error analyzing image with Gemini: {str(e)}")

async def get_relevant_images(page_numbers: List[int]):
    try:
        with open("images/images.json", "r") as f:
            all_images = json.load(f)
        return [img for img in all_images if img["page"] in page_numbers]
    except Exception as e:
        raise Exception(f"Error retrieving images: {str(e)}")


# pdf_file = "test.pdf"
# texts, metadata = extract_text_from_pdf(pdf_file)
# create_faiss_index(texts, metadata)
# extract_images_from_pdf(pdf_file)